<?php
if (!defined('ABSPATH')) { exit; }

/**
 * WordPress admin menu for the plugin (v3.7.0).
 *
 * Every screen runs the same redesigned page as the portal's admin page
 * (BSMS_UI::admin_screen), so the two always match. The older WordPress-only
 * screens, their form handlers and their styles were removed in 3.7.0; their
 * addresses still work and open the page that replaced them
 * (BSMS_UI::admin_redirects).
 */
class BSMS_Admin {

    public static function init(){
        add_action('admin_menu', array(__CLASS__, 'menu'), 9);
        add_action('admin_menu', array(__CLASS__, 'cleanup_legacy_menu_items'), 9999);
        add_filter('parent_file', array(__CLASS__, 'admin_parent_file'));
        add_filter('submenu_file', array(__CLASS__, 'admin_submenu_file'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'admin_assets'));
        add_action('admin_init', array(__CLASS__, 'redirect_retired_screens'));
        add_action('current_screen', array(__CLASS__, 'isolate_admin_notices'), 1);
    }

    public static function plugin_admin_name(){
        // The WordPress menu keeps a neutral name; the brand name is used in the portal.
        return __('Bulk SMS', 'bulk-sms-portal');
    }

    /** The main screens, in menu order. Names come from BSMS_UI::admin_labels(). */
    private static function menu_registry(){
        $items = array(
            array('slug'=>'bulk-sms-portal', 'title'=>__('Dashboard', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-users-wallets', 'title'=>__('Users & Wallets', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-funding', 'title'=>__('Payments', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-api', 'title'=>__('SMS Services', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-pricing', 'title'=>__('Pricing Manager', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-senders', 'title'=>__('Sender ID Manager', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-notices', 'title'=>__('Customer Notices', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-analytics', 'title'=>__('Reports & Insights', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-help-content', 'title'=>__('Help Content', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-system-settings', 'title'=>__('Platform Settings', 'bulk-sms-portal')),
            array('slug'=>'bulk-sms-portal-diagnostics', 'title'=>__('System Checks', 'bulk-sms-portal')),
        );
        $labels = BSMS_UI::admin_labels(); $pages = array_flip(BSMS_UI::admin_twins());
        foreach ($items as &$item) { $p = $pages[$item['slug']] ?? ''; if ($p && isset($labels[$p])) $item['title'] = $labels[$p]; }
        unset($item);
        return $items;
    }

    public static function menu(){
        $name = self::plugin_admin_name();
        $twins = array_flip(BSMS_UI::admin_twins());
        $screen = function($page){ return function() use ($page){ BSMS_UI::admin_screen($page); }; };
        add_menu_page($name, $name, 'manage_options', 'bulk-sms-portal', $screen($twins['bulk-sms-portal'] ?? 'admin-dashboard'), 'dashicons-email-alt2', 58);
        foreach (self::menu_registry() as $item) {
            if (!isset($twins[$item['slug']])) continue;
            add_submenu_page('bulk-sms-portal', $item['title'], $item['title'], 'manage_options', $item['slug'], $screen($twins[$item['slug']]));
        }
        // Extra tools (not in the menu; reached from the Admin Dashboard).
        foreach (BSMS_UI::admin_extra_pages() as $page=>$def) {
            $hook = add_submenu_page('', $def[0], $def[0], 'manage_options', $def[1], $screen($page));
            // Pages outside the menu have no title of their own in WordPress; give them one.
            if ($hook) add_action('load-' . $hook, function() use ($def){ $GLOBALS['title'] = $def[0]; });
        }
        // Older addresses: opened with GET they redirect in admin_init; anything
        // else gets a short page with a link to where the screen went.
        foreach (BSMS_UI::admin_redirects() as $slug=>$to) {
            $hook = add_submenu_page('', __('Moved', 'bulk-sms-portal'), __('Moved', 'bulk-sms-portal'), 'manage_options', $slug, function() use ($to){
                echo ('<div class="wrap"><h1>' . esc_html__('This page has moved', 'bulk-sms-portal') . '</h1><p><a class="button button-primary" href="') . esc_url(BSMS_UI::admin_page_url($to[0], $to[1])) . '">Open it</a></p></div>';
            });
            if ($hook) add_action('load-' . $hook, function(){ $GLOBALS['title'] = 'Moved'; });
        }
    }

    /** Older duplicate screens open the redesigned page instead. */
    public static function redirect_retired_screens(){
        if (!is_admin() || wp_doing_ajax() || empty($_GET['page'])) return; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reads which admin page is open.
        $page = sanitize_key((string)$_GET['page']); // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.MissingUnslash -- Only reads which admin page is open; sanitize_key() keeps a-z, 0-9, - and _.
        $map = BSMS_UI::admin_redirects();
        if (!isset($map[$page]) || !current_user_can('manage_options')) return;
        if (BSMS_Util::server_value('REQUEST_METHOD', 'GET') === 'POST') return;
        wp_safe_redirect(BSMS_UI::admin_page_url($map[$page][0], $map[$page][1]));
        exit;
    }

    public static function admin_assets($hook=''){
        if (strpos((string)$hook, 'bulk-sms-portal') === false) return;
        if (!wp_style_is('bsms-portal-ui', 'registered')) BSMS_Portal::assets();
        wp_enqueue_style('bsms-portal-ui');
    }

    public static function is_bsms_admin_screen($screen = null){
        if (!$screen && function_exists('get_current_screen')) $screen = get_current_screen();
        $screen_id = $screen && isset($screen->id) ? (string)$screen->id : '';
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reads which admin page is open.
        return strpos($screen_id, 'bulk-sms-portal') !== false || strpos($page, 'bulk-sms-portal') === 0;
    }

    /** Our screens show their own messages; other plugins' and themes' notices are hidden here. */
    public static function isolate_admin_notices($screen = null){
        if (!self::is_bsms_admin_screen($screen)) return;
        remove_all_actions('admin_notices');
        remove_all_actions('all_admin_notices');
        remove_all_actions('network_admin_notices');
        remove_all_actions('user_admin_notices');
    }

    /** Extra tools and moved addresses keep their menu parent highlighted. */
    private static function admin_menu_hub($page){
        if (isset(BSMS_UI::admin_redirects()[$page])) {
            $to = BSMS_UI::admin_redirects()[$page][0];
            return BSMS_UI::admin_twins()[$to] ?? 'bulk-sms-portal';
        }
        foreach (BSMS_UI::admin_extra_pages() as $def) if ($def[1] === $page) return 'bulk-sms-portal';
        return $page;
    }

    public static function admin_parent_file($parent_file){
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reads which admin page is open.
        return strpos($page, 'bulk-sms-portal') === 0 ? 'bulk-sms-portal' : $parent_file;
    }

    public static function admin_submenu_file($submenu_file){
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reads which admin page is open.
        return strpos($page, 'bulk-sms-portal') === 0 ? self::admin_menu_hub($page) : $submenu_file;
    }

    /** Keep only our main screens in the menu (other code may add items). */
    public static function cleanup_legacy_menu_items(){
        global $submenu;
        $parent = 'bulk-sms-portal';
        if (empty($submenu[$parent]) || !is_array($submenu[$parent])) return;
        $allowed = array_map(function($i){ return $i['slug']; }, self::menu_registry());
        foreach ($submenu[$parent] as $index => $row) {
            if (!in_array((string)($row[2] ?? ''), $allowed, true)) unset($submenu[$parent][$index]);
        }
        $submenu[$parent] = array_values($submenu[$parent]);
    }
}
