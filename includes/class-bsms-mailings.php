<?php
if (!defined('ABSPATH')) exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

/** Account welcome email and opted-in scheduled customer email updates. */
class BSMS_Mailings {
    public static function init(){}

    public static function welcome($user_id){
        if (get_user_meta($user_id, 'bsms_welcome_email_sent', true)) return;
        $user = get_user_by('id', absint($user_id));
        if (!$user || !is_email($user->user_email)) return;
        $brand = wp_specialchars_decode(get_bloginfo('name'), ENT_QUOTES);
        $subject = sprintf(/* translators: %s: a value filled in when shown */ __('Welcome to %s', 'bulk-sms-portal'), $brand);
        $body = sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('Dear %1$s,

Your account is ready. You can add money, prepare a message and check its result in your portal.

Open your portal: %2$s

If you did not create this account, please contact us.

%3$s', 'bulk-sms-portal'), ($user->display_name ?: $user->user_login), BSMS_Util::page_url(), $brand);
        if (BSMS_Notifications::mail($user->user_email, $subject, $body)) update_user_meta($user_id, 'bsms_welcome_email_sent', BSMS_Util::now_gmt());
        $admin_email = BSMS_Notifications::admin_notification_email();
        if (is_email($admin_email) && !get_user_meta($user_id, 'bsms_registration_admin_email_sent', true)) {
            if (BSMS_Notifications::mail($admin_email, __('New customer registration', 'bulk-sms-portal'), sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('A customer created an account.

Username: %1$s
Email: %2$s
Registered: %3$s UTC

Review the account in Admin Users.', 'bulk-sms-portal'), $user->user_login, $user->user_email, BSMS_Util::now_gmt()), array(), array('preheader'=>__('A new customer has registered', 'bulk-sms-portal'),'cta_label'=>__('Review customer', 'bulk-sms-portal'),'cta_url'=>BSMS_Util::page_url('admin-users')))) update_user_meta($user_id, 'bsms_registration_admin_email_sent', BSMS_Util::now_gmt());
        }
    }
}
