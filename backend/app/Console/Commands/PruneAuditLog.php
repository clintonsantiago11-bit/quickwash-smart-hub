<?php

namespace App\Console\Commands;

use App\Support\AuditRetention;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class PruneAuditLog extends Command
{
    protected $signature = 'audit:prune
        {--days= : Keep this many days of history (default 90)}
        {--dry-run : Report what would be deleted without deleting it}';

    protected $description = 'Delete audit trail rows older than the retention window, in chunks';

    public function handle(): int
    {
// '0' is falsy in PHP, so ?: would silently turn an explicit --days=0 into
// the default and prune anyway. Only an absent or empty option falls back.
$raw = $this->option('days');
$days = ($raw === null || $raw === '') ? AuditRetention::DEFAULT_DAYS : (int) $raw;

if ($days < 1) {
    $this->error('Retention must be at least one day.');

    return self::FAILURE;
}

        $preview = AuditRetention::preview($days);

        if ($preview['approaching_count'] > 0) {
            // Say it every run, so the warning is visible in Render's logs and
            // not only in the dashboard.
            Log::warning(
                "Audit retention: {$preview['expiring_count']} row(s) will be deleted "
                . "(cutoff {$preview['cutoff_at']}); a further "
                . "{$preview['approaching_count']} row(s) fall inside the next "
                . AuditRetention::WARN_DAYS_BEFORE_DELETE . " days. Export anything still needed."
            );
        }

        if ($this->option('dry-run')) {
            $this->info("Would delete {$preview['expiring_count']} row(s) older than {$preview['cutoff_at']}.");
            $this->line("{$preview['approaching_count']} more row(s) are inside the warning window.");

            return self::SUCCESS;
        }

        $deleted = AuditRetention::prune(
            \DateTimeImmutable::createFromInterface(AuditRetention::cutoff($days))
        );

        $this->info("Deleted {$deleted} audit row(s) older than {$days} days.");

        return self::SUCCESS;
    }
}