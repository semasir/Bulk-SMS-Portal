<?php
/**
 * Plugin Name:       Bulk SMS Portal
 * Plugin URI:        https://newbulksms.com/
 * Description:       Run your own bulk SMS business: a customer portal with wallets, pricing by network and country, sender names, delivery reports and an API, plus admin tools to manage it all.
 * Version:           3.9.1
 * Requires at least: 6.4
 * Requires PHP:      8.0
 * Author:            Semasir Connect
 * Author URI:        https://semasir.com.ng/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       bulk-sms-portal
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) { exit; }

/*
 * Recovery/audit guard.
 * Multiple historical builds of this plugin share the same BSMS_* PHP class
 * namespace. Loading two copies together can cause fatal redeclarations or
 * conflicting path constants. Refuse to bootstrap this copy if another one
 * is already loaded.
 */
if (
    class_exists('BSMS_DB', false) ||
    class_exists('BSMS_REST', false) ||
    class_exists('BSMS_Portal', false) ||
    defined('BSMS_PRO_PATH') ||
    defined('BSMS_PRO_URL')
) {
    add_action('admin_notices', function(){
        if (!current_user_can('activate_plugins')) return;
        echo '<div class="notice notice-error"><p><strong>' . esc_html__('Bulk SMS Portal was not loaded.', 'bulk-sms-portal') . '</strong> ' . esc_html__('Another copy of this SMS plugin is already active. Deactivate the older copy before activating this one.', 'bulk-sms-portal') . '</p></div>';
    });
    return;
}


define('BSMS_PRO_VERSION', '3.9.1');
define('BSMS_PRO_PATH', plugin_dir_path(__FILE__));
define('BSMS_PRO_URL', plugin_dir_url(__FILE__));
define('BSMS_PRO_SLUG', 'bulk-sms-portal');
define('BSMS_PORTAL_NAME', 'SMS Portal');
define('BSMS_GATEWAY_NAME', 'SMS Gateway');

require_once __DIR__ . '/includes/class-bsms-public-seo.php';
require_once __DIR__ . '/includes/class-bsms-util.php';
require_once __DIR__ . '/includes/class-bsms-db.php';
require_once __DIR__ . '/includes/class-bsms-security.php';
require_once __DIR__ . '/includes/class-bsms-capabilities.php';
require_once __DIR__ . '/includes/class-bsms-entitlements.php';
require_once __DIR__ . '/includes/class-bsms-wallet.php';
require_once __DIR__ . '/includes/class-bsms-funding.php';
require_once __DIR__ . '/includes/class-bsms-notifications.php';
require_once __DIR__ . '/includes/class-bsms-mailings.php';
require_once __DIR__ . '/includes/class-bsms-api.php';
require_once __DIR__ . '/includes/class-bsms-pricing.php';
require_once __DIR__ . '/includes/class-bsms-providers.php';
require_once __DIR__ . '/includes/class-bsms-campaigns.php';
require_once __DIR__ . '/includes/class-bsms-private-proofs.php';
require_once __DIR__ . '/includes/class-bsms-rest.php';
require_once __DIR__ . '/includes/class-bsms-records.php';
require_once __DIR__ . '/includes/class-bsms-public-api.php';
require_once __DIR__ . '/includes/class-bsms-queue.php';
require_once __DIR__ . '/includes/class-bsms-routing.php';
require_once __DIR__ . '/includes/class-bsms-finalizer.php';
require_once __DIR__ . '/includes/class-bsms-dlr.php';
require_once __DIR__ . '/includes/class-bsms-payments.php';
require_once __DIR__ . '/includes/class-bsms-admin.php';
require_once __DIR__ . '/includes/class-bsms-cron.php';
require_once __DIR__ . '/includes/class-bsms-ui.php';
require_once __DIR__ . '/includes/class-bsms-admin-tools.php';
require_once __DIR__ . '/includes/class-bsms-portal.php';
require_once __DIR__ . '/includes/class-bsms-shortcodes.php';

register_activation_hook(__FILE__, array('BSMS_DB', 'activate'));
register_activation_hook(__FILE__, array('BSMS_Public_API', 'activate'));
register_activation_hook(__FILE__, array('BSMS_Queue', 'activate'));
register_activation_hook(__FILE__, array('BSMS_Portal', 'activate'));
register_deactivation_hook(__FILE__, array('BSMS_Cron', 'deactivate'));
register_deactivation_hook(__FILE__, array('BSMS_Public_API', 'deactivate'));
register_deactivation_hook(__FILE__, array('BSMS_Queue', 'deactivate'));
register_deactivation_hook(__FILE__, array('BSMS_Portal', 'deactivate'));

add_action('plugins_loaded', function(){
    // v1.5.9: remove deprecated manual Network Status state.
    // Database upgrades run on init, after translations can load.
    add_action('init', array('BSMS_DB', 'init'), 0);
    BSMS_Mailings::init();
    BSMS_Private_Proofs::init();
    BSMS_Cron::init();
    BSMS_REST::init();
    BSMS_Records::init();
    BSMS_Public_API::init();
    BSMS_Payments::init();
    BSMS_DLR::init();
    BSMS_Queue::init();
    BSMS_Routing::init();
    BSMS_Finalizer::init();
    BSMS_Admin::init();
    BSMS_Public_SEO::init();
    BSMS_Portal::init();
    BSMS_Shortcodes::init();
    BSMS_Admin_Tools::init();
});

// A link to the optional Pro add-on on the Plugins screen, shown only while Pro is not installed.
add_filter('plugin_row_meta', function($links, $file){
    if ($file !== plugin_basename(__FILE__) || class_exists('BSMSP_Loader')) return $links;
    $links[] = '<a href="' . esc_url('https://newbulksms.com/bulk-sms-portal-pro/') . '" target="_blank" rel="noopener">' . esc_html__('Pro add-on', 'bulk-sms-portal') . '</a>';
    return $links;
}, 10, 2);

add_action('user_register', function($user_id){
    $free_units = intval(get_option('bsms_free_units_new_user', 0));
    if ($free_units <= 0) return;

    $amount = $free_units * BSMS_Pricing::base_unit_kobo();
    $ref = 'WELCOME-' . $user_id . '-' . time();

    $ok = BSMS_Wallet::credit_sms($user_id, $amount, $ref, array('reason'=>'new_user_free_units','units'=>$free_units));
    if (!is_wp_error($ok)) {
        $brand = BSMS_Util::brand_name();
        $site = home_url();
        $msg = "Welcome to {$brand}. You received {$free_units} free SMS. Buy more SMS on {$site}";
        $user = get_user_by('id', $user_id);
        if ($user && $user->user_email) BSMS_Notifications::mail($user->user_email, "Welcome to {$brand}", $msg);
    }
});
