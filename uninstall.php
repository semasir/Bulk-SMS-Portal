<?php
/**
 * Runs when the plugin is deleted from Plugins. Nothing is removed unless
 * "Delete all data when the plugin is deleted" is switched on in Platform
 * Settings. Your WordPress pages (portal, sign-in, pricing) are left in place.
 */
if (!defined('WP_UNINSTALL_PLUGIN')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

function bsms_uninstall_site(){
    global $wpdb;

    // Scheduled background work.
    foreach (array('bsms_pro_queue_worker','bsms_poll_dlr','bsms_retry_failed_messages','bsms_process_subscriptions','bsms_newsletter_batch','bsms_migrate_legacy_proofs','bsms_prune_logs') as $hook) {
        wp_clear_scheduled_hook($hook);
    }

    if (!get_option('bsms_delete_data_on_uninstall', 0)) return;

    // Every table the plugin created (wp_bsms_*), including ones from older versions.
    $like = $wpdb->esc_like($wpdb->prefix . 'bsms_') . '%';
    foreach ((array)$wpdb->get_col($wpdb->prepare('SHOW TABLES LIKE %s', $like)) as $table) {
        $wpdb->query($wpdb->prepare('DROP TABLE IF EXISTS %i', $table));
    }

    // Settings, cached values and per-user data.
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
        $wpdb->esc_like('bsms_') . '%', $wpdb->esc_like('_transient_bsms_') . '%', $wpdb->esc_like('_transient_timeout_bsms_') . '%'));
    $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->usermeta} WHERE meta_key LIKE %s", $wpdb->esc_like('bsms_') . '%'));

    // The customer role and the plugin's permissions on other roles.
    remove_role('bsms_customer');
    $caps = array('bsms_access_portal','bsms_compose_sms','bsms_send_sms','bsms_manage_groups','bsms_view_history','bsms_view_reports','bsms_view_transactions','bsms_buy_sms','bsms_manage_sender_ids','bsms_manage_notifications','bsms_manage_platform','bsms_use_api');
    foreach (wp_roles()->role_objects as $role) foreach ($caps as $cap) if ($role->has_cap($cap)) $role->remove_cap($cap);
}

if (is_multisite()) {
    foreach (get_sites(array('fields'=>'ids', 'number'=>0)) as $bsms_site_id) { switch_to_blog($bsms_site_id); bsms_uninstall_site(); restore_current_blog(); }
} else {
    bsms_uninstall_site();
}
