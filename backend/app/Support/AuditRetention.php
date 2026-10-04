<?php

namespace App\Support;

/**
 * How long the audit trail is kept, and when the operator is warned that
 * something is about to be deleted.
 *
 * Deleting audit rows is irreversible, so the warning window is not
 * decoration: a prune run reports what it is about to remove, and the dashboard
 * says so for WARN_DAYS_BEFORE_DELETE days before the cutoff actually lands.
 */
final class AuditRetention
{
    /** Default window. Overridable per run with --days. */
    public const DEFAULT_DAYS = 90;

    /**
     * How far ahead to warn. The prune runs daily, so this is how many days
     * of warning an operator gets before rows actually disappear.
     */
    public const WARN_DAYS_BEFORE_DELETE = 7;

    /**
     * Rows are deleted in batches rather than one statement. A single large
     * DELETE on TiDB holds locks for its whole duration and bloats the
     * transaction log; chunks keep each one short.
     */
    public const DELETE_CHUNK = 500;

    /** The instant before which rows are eligible for deletion. */
    public static function cutoff(int $days, ?\DateTimeInterface $now = null): \DateTimeImmutable
    {
        return ($now ? \DateTimeImmutable::createFromInterface($now) : new \DateTimeImmutable())
            ->modify("-{$days} days");
    }

    /**
     * Everything the UI needs to warn before anything is lost.
     *
     * expiring_count is the number of rows that disappear on the next run.
     * approaching_count is larger: rows still safe today but inside the
     * warning window, which is what an operator should be told to export now.
     */
    public static function preview(int $days = self::DEFAULT_DAYS, ?\DateTimeInterface $now = null): array
    {
        $now = $now ? \DateTimeImmutable::createFromInterface($now) : new \DateTimeImmutable();

        $cutoff = self::cutoff($days, $now);
        $warnFrom = $cutoff->modify('+' . self::WARN_DAYS_BEFORE_DELETE . ' days');

        $expiring = self::countOlderThan($cutoff);
        $approaching = self::countBetween($cutoff, $warnFrom);

        return [
            'retention_days' => $days,
            // format() rather than toIso8601String(): this is a plain
            // DateTimeImmutable, and that method only exists on Carbon.
            'cutoff_at' => $cutoff->format(DATE_ATOM),
            'warn_at' => $warnFrom->format(DATE_ATOM),

            // How long until the next run deletes something.
            //
            // Rows past the cutoff are not "83 days away", they are already
            // due and go on the next scheduled run, so that is zero days. The
            // rows still inside the window are the ones with time left on
            // them, and the window is bounded by how long it is wide.
            'days_until_delete' => match (true) {
                $expiring > 0 => 0,
                $approaching > 0 => self::WARN_DAYS_BEFORE_DELETE,
                default => null,
            },

            'expiring_count' => $expiring,
            'approaching_count' => $approaching,
            'warn_days_before_delete' => self::WARN_DAYS_BEFORE_DELETE,
        ];
    }

    public static function countOlderThan(\DateTimeInterface $cutoff): int
    {
        return \App\Models\AuditLog::where('created_at', '<', $cutoff)->count();
    }

    public static function countBetween(\DateTimeInterface $from, \DateTimeInterface $to): int
    {
        return \App\Models\AuditLog::where('created_at', '>=', $from)
            ->where('created_at', '<', $to)
            ->count();
    }

    /**
     * Deletes in chunks, oldest first, and reports what went.
     *
     * Ordered by id so each chunk is a contiguous range, and the loop keeps
     * going until nothing is left rather than assuming one pass is enough.
     */
    public static function prune(\DateTimeInterface $cutoff, int $chunk = self::DELETE_CHUNK): int
    {
        $deleted = 0;

        do {
            $ids = \App\Models\AuditLog::where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit($chunk)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += \App\Models\AuditLog::whereIn('id', $ids)->delete();
        } while ($chunk > 0);

        return $deleted;
    }
}