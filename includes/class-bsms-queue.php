<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Queue {
    public static function init(){
        // Historical queue retained for data compatibility only. Campaign sending is owned by BSMS_Cron.
        add_action('bsms_retry_failed_messages', array(__CLASS__, 'retry_failed'));
        add_filter('cron_schedules', array(__CLASS__, 'schedules'));
    }

    public static function schedules($schedules){
        if (!isset($schedules['bsms_every_minute'])) {
            $schedules['bsms_every_minute'] = array('interval'=>60,'display'=>__('Every minute for Bulk SMS Portal', 'bulk-sms-portal'));
        }
        if (!isset($schedules['bsms_every_five_minutes'])) {
            $schedules['bsms_every_five_minutes'] = array('interval'=>300,'display'=>__('Every five minutes for Bulk SMS Portal DLR sync', 'bulk-sms-portal'));
        }
        return $schedules;
    }

    public static function activate(){
        wp_clear_scheduled_hook('bsms_process_queue');
        if (!wp_next_scheduled('bsms_retry_failed_messages')) wp_schedule_event(time()+300, 'hourly', 'bsms_retry_failed_messages');
        if (!wp_next_scheduled('bsms_poll_dlr')) wp_schedule_event(time()+300, 'bsms_every_five_minutes', 'bsms_poll_dlr');
    }

    public static function deactivate(){
        wp_clear_scheduled_hook('bsms_process_queue');
        wp_clear_scheduled_hook('bsms_retry_failed_messages');
        wp_clear_scheduled_hook('bsms_poll_dlr');
    }



    public static function retry_failed(){
        global $wpdb;
        $q = BSMS_DB::table('queue');
        $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_queue SET status='retry', next_run_at=%s, updated_at=%s WHERE status='failed' AND attempts < 3", BSMS_Util::now_gmt(), BSMS_Util::now_gmt()));
    }
}
