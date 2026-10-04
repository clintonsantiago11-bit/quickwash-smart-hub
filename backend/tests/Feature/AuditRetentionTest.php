<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Support\AuditRetention;
use Tests\TestCase;

/**
 * Deleting audit rows cannot be undone, so these cover both halves: that the
 * warning describes what is about to happen, and that the prune only removes
 * what it said it would.
 */
class AuditRetentionTest extends TestCase
{
    /**
     * These assertions are about exact counts, so the table starts empty.
     * This is the dedicated test database (quickwash_hub_test), not the
     * application's, and RefreshDatabase is unavailable because Mockery is
     * not installed here.
     */
    protected function setUp(): void
    {
        parent::setUp();

        AuditLog::query()->delete();
    }

    protected function tearDown(): void
    {
        AuditLog::query()->delete();

        parent::tearDown();
    }

    private function seedAudit(int $daysOld, string $action = 'LOGIN'): AuditLog
    {
        $log = new AuditLog();
        $log->user = 'Test';
        $log->action = $action;
        $log->details = 'seeded';
        $log->created_at = now()->subDays($daysOld);
        $log->save();

        return $log;
    }

    public function test_the_window_defaults_to_ninety_days_and_warns_a_week_ahead(): void
    {
        $this->assertSame(90, AuditRetention::DEFAULT_DAYS);
        $this->assertSame(7, AuditRetention::WARN_DAYS_BEFORE_DELETE);
    }

    public function test_preview_counts_what_is_expiring_and_what_is_approaching(): void
    {
        $this->seedAudit(200); // long expired
        $this->seedAudit(120); // expired
        // Inside the seven day warning window: the cutoff is 90 days ago, so
        // anything between 83 and 90 days old is not yet due but is close.
        $this->seedAudit(85);
        $this->seedAudit(2);   // safe

        $preview = AuditRetention::preview();

        $this->assertSame(2, $preview['expiring_count'], 'two rows are past the cutoff');
        $this->assertSame(1, $preview['approaching_count'], 'one more is about to be');
        $this->assertSame(90, $preview['retention_days']);

        // Rows already past the cutoff are due now, so nothing is "83 days
        // away" from them: they go on the next run.
        $this->assertSame(
            0,
            $preview['days_until_delete'],
            'rows past the cutoff are deleted on the next run, not sometime later',
        );
    }

    public function test_rows_still_inside_the_warning_window_are_reported_as_approaching(): void
    {
        $this->seedAudit(85); // inside the window, not yet due

        $preview = AuditRetention::preview();

        $this->assertSame(0, $preview['expiring_count']);
        $this->assertSame(1, $preview['approaching_count']);
        $this->assertSame(
            AuditRetention::WARN_DAYS_BEFORE_DELETE,
            $preview['days_until_delete'],
            'approaching rows have the length of the warning window left',
        );
    }

    public function test_nothing_pending_means_no_countdown(): void
    {
        $this->seedAudit(2);

        $preview = AuditRetention::preview();

        $this->assertNull($preview['days_until_delete'], 'no rows are at risk');
    }

    public function test_preview_is_empty_and_quiet_when_there_is_nothing_to_delete(): void
    {
        $this->seedAudit(3);

        $preview = AuditRetention::preview();

        $this->assertSame(0, $preview['expiring_count']);
        $this->assertSame(0, $preview['approaching_count']);
    }

    public function test_prune_removes_only_rows_older_than_the_window(): void
    {
        $old = $this->seedAudit(200);
        $older = $this->seedAudit(365);
        $recent = $this->seedAudit(10);
        $edge = $this->seedAudit(89);

        $deleted = AuditRetention::prune(now()->subDays(90));

        $this->assertSame(2, $deleted);
        $this->assertDatabaseMissing('audit_logs', ['id' => $old->id]);
        $this->assertDatabaseMissing('audit_logs', ['id' => $older->id]);
        // Note: the third argument here would be a connection name, not a
        // message, so these are plain assertions with the reason alongside.
        $this->assertTrue(
            AuditLog::whereKey($recent->id)->exists(),
            'a recent row must survive the prune',
        );
        $this->assertTrue(
            AuditLog::whereKey($edge->id)->exists(),
            'a row inside the window must survive the prune',
        );
    }

    public function test_prune_deletes_everything_when_it_runs_in_chunks(): void
    {
        // More rows than one chunk, so the loop has to keep going rather than
        // assuming a single pass clears the table.
        $total = AuditRetention::DELETE_CHUNK + 25;
        for ($i = 0; $i < $total; $i++) {
            $this->seedAudit(200 + $i);
        }
        $this->seedAudit(1);

        $deleted = AuditRetention::prune(now()->subDays(90));

        $this->assertSame($total, $deleted, 'every expired row goes, across chunk boundaries');
        $this->assertSame(1, AuditLog::count(), 'only the safe row is left');
    }

    public function test_pruning_leaves_the_audit_trail_usable(): void
    {
        $this->seedAudit(5, 'CHANGE_PASSWORD');

        AuditRetention::prune(now()->subDays(90));

        $this->assertDatabaseHas('audit_logs', ['action' => 'CHANGE_PASSWORD']);
    }

    public function test_dry_run_reports_without_deleting(): void
    {
        $this->seedAudit(200);

        // Driven through the Artisan facade rather than $this->artisan(): the
        // test helper mocks console output, and Mockery is not installed here.
        $exit = \Illuminate\Support\Facades\Artisan::call('audit:prune', ['--dry-run' => true]);

        $this->assertSame(0, $exit);
        $this->assertStringContainsString('Would delete 1 row', \Illuminate\Support\Facades\Artisan::output());
        $this->assertSame(1, AuditLog::count(), 'a dry run must not delete anything');
    }

    public function test_the_command_deletes_when_not_a_dry_run(): void
    {
        $this->seedAudit(200);
        $this->seedAudit(2);

        $exit = \Illuminate\Support\Facades\Artisan::call('audit:prune');

        $this->assertSame(0, $exit);
        $this->assertSame(1, AuditLog::count());
    }

    public function test_the_command_refuses_a_nonsense_window(): void
    {
        $this->artisanIsRefusedFor(0);
        $this->artisanIsRefusedFor(-5);
    }

    private function artisanIsRefusedFor(int $days): void
    {
        $exit = \Illuminate\Support\Facades\Artisan::call('audit:prune', ['--days' => (string) $days]);

        $this->assertSame(1, $exit, "a window of {$days} days must be refused");
    }

    public function test_the_retention_endpoint_requires_an_admin(): void
    {
        $this->asAnonymous()->getJson('/api/audit-logs/retention')->assertStatus(401);
    }

    public function test_the_retention_endpoint_describes_the_pending_deletion(): void
    {
        $this->seedAudit(200);

        $admin = new \App\Models\User();
        $admin->forceFill([
            'username' => 'ret_admin_' . uniqid(),
            'full_name' => 'Retention Admin',
            'email' => 'ret_' . uniqid() . '@example.com',
            'password_hash' => \Illuminate\Support\Facades\Hash::make('password123'),
            'role' => 'admin',
            'facility_id' => 1,
        ])->save();

        $body = $this->asToken($admin->createToken('t')->plainTextToken)
            ->getJson('/api/audit-logs/retention')
            ->assertStatus(200)
            ->json();

        $this->assertSame(1, $body['expiring_count']);
        $this->assertSame(90, $body['retention_days']);
        $this->assertArrayHasKey('cutoff_at', $body);
        $this->assertArrayHasKey('warn_days_before_delete', $body);

        $admin->delete();
    }
}