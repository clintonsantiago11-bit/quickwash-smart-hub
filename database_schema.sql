-- QuickWash Smart Hub - MySQL Database Schema
-- Run this in PHPMyAdmin or via MySQL CLI

CREATE DATABASE IF NOT EXISTS quickwash_hub;
USE quickwash_hub;

-- --------------------------------------------------------
-- Table structure for `facilities`
-- (Assuming future multi-bay expansion, though currently single-bay)
-- --------------------------------------------------------
CREATE TABLE `facilities` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `status` enum('active','maintenance','offline') DEFAULT 'active',
  `sync_pending` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL UNIQUE,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL UNIQUE,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin', 'manager', 'technician') DEFAULT 'admin',
  `facility_id` int(11) DEFAULT NULL COMMENT 'Assigned facility for managers/technicians',
  `avatar_url` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `designation` varchar(100) DEFAULT 'System Administrator',
  `is_dark_mode` tinyint(1) DEFAULT 1,
  `email_alerts` tinyint(1) DEFAULT 0,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `devices`
-- --------------------------------------------------------
CREATE TABLE `devices` (
  `id` varchar(50) NOT NULL COMMENT 'ESP32 MAC Address or custom ID',
  `facility_id` int(11) DEFAULT 1,
  `name` varchar(100) NOT NULL,
  `type` enum('controller','camera','vending') NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `status` enum('online','offline','error') DEFAULT 'offline',
  `last_seen` timestamp NULL DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `sensor_logs`
-- (Logs historical data for tank levels and temperatures)
-- --------------------------------------------------------
CREATE TABLE `sensor_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` varchar(50) NOT NULL,
  `water_level` float DEFAULT NULL,
  `soap_a_level` float DEFAULT NULL,
  `soap_b_level` float DEFAULT NULL,
  `wax_level` float DEFAULT NULL,
  `temperature` float DEFAULT NULL,
  `flow_rate` float DEFAULT NULL,
  `recorded_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `vending_transactions`
-- (Stores every coin drop)
-- --------------------------------------------------------
CREATE TABLE `vending_transactions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` varchar(50) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('coin') DEFAULT 'coin',
  `transaction_time` timestamp DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `alerts`
-- (Stores hardware errors, jams, and low level warnings)
-- --------------------------------------------------------
CREATE TABLE `alerts` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `device_id` varchar(50) NOT NULL,
  `type` varchar(50) NOT NULL COMMENT 'e.g., JAM_ERROR, LOW_SOAP',
  `severity` enum('info','warning','critical') NOT NULL,
  `message` text NOT NULL,
  `resolved` tinyint(1) DEFAULT 0,
  `resolved_by` int(11) DEFAULT NULL COMMENT 'User who marked alert as resolved',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `audit_logs`
-- (Stores administrative actions, logins, settings changes)
-- --------------------------------------------------------
CREATE TABLE `audit_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL COMMENT 'Reference to the acting user',
  `user` varchar(100) NOT NULL DEFAULT 'System' COMMENT 'Fallback user name or system name',
  `action` varchar(100) NOT NULL,
  `details` text,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `password_reset_tokens`
-- (Laravel password reset tokens)
-- --------------------------------------------------------
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `personal_access_tokens`
-- (Laravel Sanctum API tokens - required for login)
-- --------------------------------------------------------
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL UNIQUE,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tokenable_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial Seed Data
INSERT INTO `facilities` (`id`, `name`) VALUES (1, 'QuickWash Main Facility');

-- Default Admin (password: admin123 - bcrypt hashed)
INSERT INTO `users` (`username`, `full_name`, `email`, `password_hash`, `role`, `facility_id`) 
VALUES ('admin', 'System Administrator', 'admin@quickwash.hub', '$2y$10$9Xk.A75uNylW6Ba4DSEoLumXa1ie6MyJYM7aUcaQBhyFBRL6GWPfq', 'admin', 1);

INSERT INTO `devices` (`id`, `facility_id`, `name`, `type`) VALUES 
('esp32_bay_1', 1, 'Main Wash Controller', 'controller'),
('esp32_cam_1', 1, 'Bay Camera', 'camera'),
('esp32_vending', 1, 'Coin Acceptor Node', 'vending');

-- --------------------------------------------------------
-- NAEK device mirror (2-way sync with the iot-bridge edge agent)
-- sync_pending=1 -> a dashboard edit awaits the device's /save apply
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `naek_config` (
  `device_id` varchar(50) NOT NULL,
  `shop_name` varchar(100) DEFAULT '',
  `lcd_sleep_min` int(11) DEFAULT 60,
  `credits` int(11) DEFAULT 0,
  `total_sales` int(11) DEFAULT 0,
  `sync_pending` tinyint(1) DEFAULT 0,
  `last_seen_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `naek_products` (
  `device_id` varchar(50) NOT NULL,
  `slot` tinyint(4) NOT NULL,
  `name` varchar(50) DEFAULT '',
  `rate` int(11) DEFAULT 0,
  `duration_seconds` int(11) DEFAULT 0,
  `pause_enabled` tinyint(1) DEFAULT 1,
  `usage` int(11) DEFAULT 0,
  `net` int(11) DEFAULT 0,
  `status` enum('ON','OFF') DEFAULT 'OFF',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`device_id`,`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
