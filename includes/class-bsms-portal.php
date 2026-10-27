<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Portal {
    public static function can_manage(){
        // One authority for both portal presentation and REST/data scope. This
        // prevents an account being shown the admin UI while REST still applies
        // customer-only Message History, Reports or Transactions scope.
        if (class_exists('BSMS_Capabilities')) return BSMS_Capabilities::can_manage_platform();
        if (!is_user_logged_in()) return false;
        if (function_exists('is_super_admin') && is_super_admin(get_current_user_id())) return true;
        return current_user_can('manage_options') || current_user_can('bsms_manage_platform');
    }

    public static function route_map(){
        return array(
            'dashboard'=>'dashboard',
            'fund'=>'fund-wallet',
            'compose'=>'compose',
            'groups'=>'phone-groups',
            'history'=>'message-history',
            'reports'=>'delivery-reports',
            'transactions'=>'transactions',
            'sender'=>'sender-id',
            'settings'=>'notification-settings',
            'api'=>'api',
            'profile'=>'profile',
            'admin-dashboard'=>'admin-dashboard',
            'admin-users'=>'admin-users',
            'admin-credit'=>'admin-funding',
            'admin-apis'=>'admin-apis',
            'admin-pricing'=>'admin-pricing',
            'admin-senders'=>'admin-senders',
            'admin-broadcast'=>'admin-broadcast',
            'admin-analytics'=>'admin-analytics',
            'admin-settings'=>'admin-settings',
            'admin-monitoring'=>'admin-monitoring',
            'admin-help'=>'admin-help-content',
        );
    }

    public static function portal_slug(){
        $slug = trim((string)get_option('bsms_portal_slug', 'portal'), '/');
        $slug = sanitize_title($slug ?: 'portal');
        return $slug ?: 'portal';
    }

    public static function feature_enabled($feature){
        $feature = sanitize_key((string)$feature);

        // Administrative workspace visibility is a Stage 3 capability concern,
        // not a customer entitlement. Never allow a customer-feature save to
        // hide the platform controls from an authorised platform manager.
        if ($feature === 'frontend_admin') {
            return self::can_manage();
        }

        if (class_exists('BSMS_Entitlements') && isset(BSMS_Entitlements::feature_registry()[$feature])) {
            return BSMS_Entitlements::is_enabled($feature, get_current_user_id());
        }
        $map = array(
            'broadcast'=>'bsms_feature_broadcast',
            'pricing'=>'bsms_feature_pricing',
        );
        $option = $map[$feature] ?? '';
        if (!$option) return true;
        return get_option($option, '1') === '1';
    }

    public static function page_enabled($page){
        // Customer API guidance is an account feature. Provider/API administration
        // remains restricted to the separate admin-apis workspace.
        if ($page === 'settings' && class_exists('BSMS_Capabilities') && !BSMS_Capabilities::can('notifications')) return false;
        $map = array(
            'fund'=>'buy_sms',
            'compose'=>'compose_sms',
            'groups'=>'phone_groups',
            'history'=>'message_history',
            'reports'=>'delivery_reports',
            'transactions'=>'transactions',
            'sender'=>'sender_ids',
            'api'=>'api_access',
        );
        if (isset($map[$page]) && !self::feature_enabled($map[$page])) return false;
        return true;
    }

    public static function route_for_page($page){
        $map = self::route_map();
        if (isset($map[$page])) return $map[$page];
        if (strpos($page, 'custom-') === 0) return sanitize_title(substr($page, 7));
        return sanitize_title($page);
    }

    public static function page_for_route($route){
        $route = sanitize_title($route);
        $map = self::route_map();
        $found = array_search($route, $map, true);
        if ($found) return $found;
        foreach (self::custom_user_menus() as $page=>$item) {
            if (self::route_for_page($page) === $route) return $page;
        }
        return $route ?: 'compose';
    }

    public static function rewrite_rules(){
        $slug = self::portal_slug();
        add_rewrite_tag('%bsms_portal_section%', '([^&]+)');
        add_rewrite_rule('^' . preg_quote($slug, '/') . '/([^/]+)/?$', 'index.php?pagename=' . $slug . '&bsms_portal_section=$matches[1]', 'top');
    }

    public static function query_vars($vars){
        $vars[] = 'bsms_portal_section';
        return $vars;
    }


    public static function maybe_flush_rewrite_rules(){
        $key = 'bsms_portal_rewrite_version';
        $expected = BSMS_PRO_VERSION . '|' . self::portal_slug();
        if (get_option($key) !== $expected) {
            self::rewrite_rules();
            flush_rewrite_rules(false);
            update_option($key, $expected, false);
        }
    }

    public static function activate(){
        self::grant_customer_capabilities();
        self::ensure_public_pages(true);
        self::rewrite_rules();
        flush_rewrite_rules();
    }

    public static function portal_customer_capabilities(){
        return array(
            'read',
            'bsms_access_portal',
            'bsms_compose_sms',
            'bsms_send_sms',
            'bsms_manage_groups',
            'bsms_view_history',
            'bsms_view_reports',
            'bsms_view_transactions',
            'bsms_buy_sms',
            'bsms_manage_sender_ids',
            'bsms_manage_notifications',
        );
    }

    public static function grant_customer_capabilities(){
        $caps = self::portal_customer_capabilities();
        if (!get_role('bsms_customer')) {
            add_role('bsms_customer', __('SMS Customer', 'bulk-sms-portal'), array_fill_keys($caps, true));
        }
        foreach (array('bsms_customer','customer','subscriber') as $role_key) {
            $role = get_role($role_key);
            if (!$role) continue;
            foreach ($caps as $cap) $role->add_cap($cap);
            // API/developer access is platform-admin only. Remove the legacy
            // customer capability during every capability reconciliation so
            // previously-created customer roles cannot retain it after upgrade.
            $role->remove_cap('bsms_use_api');
        }
        $admin = get_role('administrator');
        if ($admin) {
            foreach (array_merge($caps, array('bsms_manage_platform','bsms_use_api')) as $cap) $admin->add_cap($cap);
        }
    }

    public static function ensure_runtime_capabilities(){
        $key = 'bsms_caps_version';
        $admin = get_role('administrator');
        $admin_missing_platform_cap = $admin && !$admin->has_cap('bsms_manage_platform');

        // Do not rely only on the stored version marker: a restored database,
        // role editor, migration or interrupted update can remove the capability
        // while leaving the version option untouched.
        if (get_option($key) !== BSMS_PRO_VERSION || $admin_missing_platform_cap) {
            self::grant_customer_capabilities();
            update_option($key, BSMS_PRO_VERSION, false);
        }
    }

    public static function deactivate(){
        flush_rewrite_rules();
    }

    public static function current_page_from_request(){
        $section = get_query_var('bsms_portal_section');
        if ($section) return self::page_for_route($section);
        return '';
    }
    /** Extra customer portal pages (added by add-ons through the bsms_custom_user_menus filter). */
    public static function custom_user_menus(){
        $items = apply_filters('bsms_custom_user_menus', array());
        return is_array($items) ? $items : array();
    }

    public static function menu_registry(){
        $member = array(
            'dashboard'    => __('Dashboard', 'bulk-sms-portal'),
            'compose'      => __('Send SMS', 'bulk-sms-portal'),
            'history'      => __('Message History', 'bulk-sms-portal'),
            'fund'         => __('Buy SMS', 'bulk-sms-portal'),
            'transactions' => __('Wallet History', 'bulk-sms-portal'),
            'reports'      => __('Delivery Reports', 'bulk-sms-portal'),
            'sender'       => __('Sender ID', 'bulk-sms-portal'),
            'pricing'      => __('Pricing', 'bulk-sms-portal'),
            'groups'       => __('Phonebook', 'bulk-sms-portal'),
            'settings'     => __('Notifications', 'bulk-sms-portal'),
            'api'          => 'API',
            'profile'      => __('Profile & Security', 'bulk-sms-portal'),
            'help'         => __('Help Centre', 'bulk-sms-portal'),
        );

        foreach ($member as $page=>$label) {
            if (!self::page_enabled($page)) unset($member[$page]);
        }

        // Retain tenant/custom menu extension points without duplicating
        // canonical destinations.
        foreach (self::custom_user_menus() as $slug=>$item) {
            if (!isset($member[$slug])) $member[$slug] = $item['label'];
        }

        // One canonical platform-admin registry drives the front-end sidebar,
        // sections and admin console. Do not maintain a second partial admin menu.
        $admin = self::admin_tool_registry();

        return array('member'=>$member, 'admin'=>$admin);
    }

    public static function admin_tool_registry(){
        if (!self::can_manage()) return array();
        $tools = array(
            'admin-dashboard' => array(__('Admin Dashboard', 'bulk-sms-portal'),''),
            'admin-users'     => array(__('Users & Wallets', 'bulk-sms-portal'),''),
            'admin-credit'    => array(__('Payments & Wallets', 'bulk-sms-portal'),'manual_funding'),
            'admin-apis'      => array(__('SMS Services', 'bulk-sms-portal'),'api_access'),
            'admin-pricing'   => array(__('Pricing Manager', 'bulk-sms-portal'),'pricing'),
            'admin-senders'   => array(__('Sender ID Manager', 'bulk-sms-portal'),'sender_ids'),
            'admin-broadcast' => array(__('Customer Notices', 'bulk-sms-portal'),''),
            'admin-analytics' => array(__('Reports & Insights', 'bulk-sms-portal'),''),
            'admin-help'      => array(__('Help Content', 'bulk-sms-portal'),''),
            'admin-settings'  => array(__('Platform Settings', 'bulk-sms-portal'),''),
            'admin-monitoring'=> array(__('System Checks', 'bulk-sms-portal'),''),
        );
        // v3.5.1: admin tools are always available to platform admins. The
        // customer feature switches (Pricing, Sender IDs, API, manual funding)
        // control what customers see, not whether admins can manage them.
        // Hiding a tool here made its shortcut buttons fall through to Send SMS.
        $labels = class_exists('BSMS_UI') ? BSMS_UI::admin_labels() : array();
        $out=array();
        foreach($tools as $page=>$data){ $out[$page]=$labels[$page] ?? $data[0]; }
        return $out;
    }


    public static function render_sections($items){
        foreach ($items as $page=>$label) {
            printf(
                '<section id="bsms-page-%s" class="bsms-page hidden"></section>' . "\n",
                esc_attr($page)
            );
        }
    }

    public static function init(){
        self::ensure_runtime_capabilities();
        add_shortcode('bsms_portal', array(__CLASS__, 'render'));
        add_shortcode('bsms_wallet', array(__CLASS__, 'render'));
        add_shortcode('bsms_campaigns', array(__CLASS__, 'render'));
        add_shortcode('bsms_contacts', array(__CLASS__, 'render'));
        add_shortcode('bsms_reports', array(__CLASS__, 'render'));
        add_shortcode('bsms_login', array(__CLASS__, 'render_login'));
        add_shortcode('bsms_register', array(__CLASS__, 'render_register'));
        add_shortcode('bsms_forgot_password', array(__CLASS__, 'render_forgot_password'));
        add_shortcode('bsms_auth_links', array(__CLASS__, 'render_auth_links'));
        add_shortcode('bsms_public_buy_sms', array(__CLASS__, 'render_public_buy_sms'));
        add_shortcode('bsms_public_pricing', array(__CLASS__, 'render_public_pricing'));
        add_shortcode('bsms_help_centre', array(__CLASS__, 'render_help_centre'));
        add_shortcode('bsms_live_rates', array(__CLASS__, 'render_live_rates'));
        add_shortcode('bsms_sms_calculator', array(__CLASS__, 'render_sms_calculator'));
        add_shortcode('bsms_public_api_docs', array(__CLASS__, 'render_public_api_docs'));
        add_shortcode('bsms_payment_status', array(__CLASS__, 'render_payment_status'));
        add_action('init', array(__CLASS__, 'ensure_public_pages'), 25);
        add_action('init', array(__CLASS__, 'rewrite_rules'));
        add_action('init', array(__CLASS__, 'maybe_handle_auth_forms'));
        add_action('admin_init', array(__CLASS__, 'protect_wp_admin'));
        add_filter('show_admin_bar', array(__CLASS__, 'maybe_hide_admin_bar'));
        add_filter('login_url', array(__CLASS__, 'filter_login_url'), 10, 3);
        add_filter('register_url', array(__CLASS__, 'filter_register_url'));
        add_filter('lostpassword_url', array(__CLASS__, 'filter_lostpassword_url'), 10, 2);
        add_filter('retrieve_password_message', array(__CLASS__, 'filter_reset_password_message'), 10, 4);
        add_filter('query_vars', array(__CLASS__, 'query_vars'));
        add_action('wp_loaded', array(__CLASS__, 'maybe_flush_rewrite_rules'));
        add_action('wp_enqueue_scripts', array(__CLASS__, 'assets'));
        add_action('wp_footer', array(__CLASS__, 'popup_notices'));
        // Application/account surfaces are functional screens, not search landing pages.
        add_filter('wp_robots', array(__CLASS__, 'filter_application_robots'), 99);
        add_filter('wpseo_exclude_from_sitemap_by_post_ids', array(__CLASS__, 'exclude_application_pages_from_sitemap'));
        add_filter('comment_form_defaults', array(__CLASS__, 'add_recaptcha_to_comment_form'));
        add_filter('preprocess_comment', array(__CLASS__, 'verify_comment_recaptcha'));
        add_action('wp_ajax_bsms_refresh_nonce', array(__CLASS__, 'ajax_refresh_nonce'));
    }

    public static function assets(){
        // The owner-facing Platform Control Centre uses WordPress' native Media
        // Library for branding. Load it during wp_enqueue_scripts so both the
        // Upload files and Media Library tabs are available on the front end.
        if (is_user_logged_in() && self::can_manage() && is_singular()) {
            global $post;
            if ($post instanceof WP_Post && has_shortcode((string)$post->post_content, 'bsms_portal')) {
                wp_enqueue_media();
            }
        }

        // File fingerprints prevent stale CDN/browser assets after an in-place plugin upgrade.
        $css_file = BSMS_PRO_PATH . 'assets/portal.css';
        $js_file  = BSMS_PRO_PATH . 'assets/portal.js';
        $css_ver = BSMS_PRO_VERSION . '.' . (file_exists($css_file) ? substr(md5_file($css_file), 0, 12) : '0');
        $js_ver  = BSMS_PRO_VERSION . '.' . (file_exists($js_file) ? substr(md5_file($js_file), 0, 12) : '0');
        wp_register_style('bsms-portal', BSMS_PRO_URL . 'assets/portal.css', array(), $css_ver);
        wp_register_script('bsms-portal', BSMS_PRO_URL . 'assets/portal.js', array('wp-i18n'), $js_ver, true);
        wp_set_script_translations('bsms-portal', 'bulk-sms-portal');

        // v3.5.0 design system: one stylesheet and one script for every
        // redesigned page and the portal frame. Loaded after the older files.
        $ui_css = BSMS_PRO_PATH . 'assets/portal-ui.css';
        $ui_js  = BSMS_PRO_PATH . 'assets/portal-app.js';
        $ui_css_ver = BSMS_PRO_VERSION . '.' . (file_exists($ui_css) ? substr(md5_file($ui_css), 0, 12) : '0');
        $ui_js_ver  = BSMS_PRO_VERSION . '.' . (file_exists($ui_js) ? substr(md5_file($ui_js), 0, 12) : '0');
        // v3.7.0: the redesigned portal and admin screens no longer load the
        // older portal.css; it is only used by the public and sign-in pages.
        wp_register_style('bsms-portal-ui', BSMS_PRO_URL . 'assets/portal-ui.css', array(), $ui_css_ver);
        wp_register_script('bsms-portal-app', BSMS_PRO_URL . 'assets/portal-app.js', array('bsms-portal', 'wp-i18n'), $ui_js_ver, true);
        wp_set_script_translations('bsms-portal-app', 'bulk-sms-portal');
    }

    public static function consume_portal_announcements(){
        if (!is_user_logged_in()) return array();
        $uid = get_current_user_id();
        $raw_notices = get_user_meta($uid, 'bsms_popup_notice');
        if (!$raw_notices) return array();
        // v3.6.0: a notice stays until the customer closes it (or 30 days
        // pass), so a page reload or the sign-in redirect can't lose it.
        $items = array();
        foreach ($raw_notices as $n) {
            $data = json_decode($n, true);
            if (!is_array($data)) { delete_user_meta($uid, 'bsms_popup_notice', $n); continue; }
            $sent = strtotime(($data['created_at'] ?? '') . ' UTC');
            if ($sent && $sent < time() - 30 * DAY_IN_SECONDS) { delete_user_meta($uid, 'bsms_popup_notice', $n); continue; }
            $title = sanitize_text_field($data['title'] ?? 'Announcement');
            $message = wp_strip_all_tags((string)($data['message'] ?? ''));
            if (!$message && !$title) continue;
            $type = sanitize_key($data['type'] ?? ($data['notice_type'] ?? 'information'));
            $priority = sanitize_key($data['priority'] ?? 'normal');
            $created_at = sanitize_text_field($data['created_at'] ?? current_time('mysql'));
            $items[] = array(
                'id' => md5($n),
                'title' => $title,
                'message' => $message,
                'type' => $type ?: 'information',
                'priority' => $priority ?: 'normal',
                'created_at' => $created_at,
            );
        }
        return $items;
    }

    /** v3.6.0: the customer closed a notice. */
    public static function dismiss_notice(WP_REST_Request $r){
        $uid = get_current_user_id();
        $id = preg_replace('/[^a-f0-9]/', '', (string)$r->get_param('id'));
        foreach ((array)get_user_meta($uid, 'bsms_popup_notice') as $n) {
            if ($id !== '' && hash_equals(md5($n), $id)) { delete_user_meta($uid, 'bsms_popup_notice', $n); return array('ok'=>true); }
        }
        return array('ok'=>true, 'missing'=>true);
    }

    public static function render(){
        if (!defined('DONOTCACHEPAGE')) define('DONOTCACHEPAGE', true); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedConstantFound -- Standard constant read by caching plugins.
        if (!headers_sent()) { nocache_headers(); }
        if (!is_user_logged_in()) return self::render_access_required();

        // The Brand control uses WordPress' native Media Library. Enqueue it
        // from the authoritative portal render path because routed/template
        // portal pages do not always contain the literal shortcode in post content.
        if (self::can_manage()) {
            wp_enqueue_media();
        }

        $portal_config = array(
            'root'=>esc_url_raw(rest_url('bsms/v1')),
            'nonce'=>wp_create_nonce('wp_rest'),
            'ajaxUrl'=>admin_url('admin-ajax.php'),
            'brand'=>BSMS_Util::brand_name(),
            'logo'=>BSMS_Util::logo_url(),
            'sidebarBrandDisplay'=>get_option('bsms_sidebar_brand_display','logo_only'),
            'designTokens'=>BSMS_Util::design_tokens(),
            'primary'=>BSMS_Util::primary_color(),
            'secondary'=>method_exists('BSMS_Util','secondary_color') ? BSMS_Util::secondary_color() : '#111827',
            'customMenus'=>array_values(self::custom_user_menus()),
            'isAdmin'=>self::can_manage(),
            'userId'=>get_current_user_id(),
            'supportEmail'=>BSMS_Util::support_email(),
            'entitlements'=>class_exists('BSMS_Entitlements') ? BSMS_Entitlements::matrix(get_current_user_id()) : array(),
            'cleanRoutes'=>true,
            'portalBase'=>home_url('/' . self::portal_slug()),
            'routeMap'=>self::route_map(),
            'initialPage'=>self::page_enabled(self::current_page_from_request()) ? self::current_page_from_request() : 'dashboard',
            'announcements'=>self::consume_portal_announcements(),
            'dashboardLabels'=>array(
                'recentMessages'=>get_option('bsms_dashboard_recent_messages_title','Recent Messages'),
                'recentTransactions'=>get_option('bsms_dashboard_recent_transactions_title','Recent Wallet History'),
                'compact'=>intval(get_option('bsms_dashboard_compact_mode',0))
            ),
        );
        // Block themes render shortcodes before wp_enqueue_scripts runs, so make
        // sure the portal assets exist before attaching the runtime config to them.
        if (!wp_script_is('bsms-portal', 'registered')) self::assets();
        if (!wp_script_is('bsms-portal-app', 'registered')) self::assets();
        wp_enqueue_style('bsms-portal-ui');
        wp_add_inline_script('bsms-portal', 'window.BSMS_PORTAL = '.wp_json_encode($portal_config).';', 'before');
        wp_enqueue_script('bsms-portal');
        wp_enqueue_script('bsms-portal-app');
        do_action('bsms_portal_scripts'); // add-ons enqueue their portal screens here
        wp_localize_script('bsms-portal', 'BSMS_PORTAL', $portal_config);

        $menus = self::menu_registry();

        // v3.5.0: one portal frame for every page (see BSMS_UI::frame()).
        ob_start();
        $extras = array();
        if (self::can_manage() && class_exists('BSMS_UI')) foreach (BSMS_UI::admin_extra_pages() as $page=>$def) $extras[$page] = $def[0];
        self::render_sections(array_merge($menus['member'], $menus['admin'], $extras));
        $sections = ob_get_clean();
        return BSMS_UI::frame($menus, $sections);
    }




    public static function auth_page_url($type='login'){
        $defaults = array(
            'login' => 'login',
            'register' => 'register',
            'forgot' => 'forgot-password',
            'buy' => 'buy-sms',
            'help' => 'help-centre',
            'payment' => 'payment-status',
            'pricing' => 'bulk-sms-price-nigeria',
        );
        $opt_key = 'bsms_' . sanitize_key($type) . '_page_url';
        $saved = trim((string)get_option($opt_key, ''));
        if ($saved) {
            // An explicitly configured public page is authoritative. Earlier builds
            // rewrote valid legacy/live slugs to plugin-preferred defaults, which
            // could send visitors to a page that did not exist on the installation.
            return esc_url_raw($saved);
        }
        $slug = isset($defaults[$type]) ? $defaults[$type] : 'login';
        return home_url('/' . $slug . '/');
    }

    public static function filter_application_robots($robots){
        $noindex = false;
        if (is_singular('page')) {
            $post = get_post();
            $slug = $post ? (string)$post->post_name : '';
            $protected = array('login','register','forgot-password','payment-status', self::portal_slug());
            if (in_array($slug, $protected, true)) $noindex = true;
        }
        // Portal sub-routes resolve through the portal page and should never become
        // search landing pages even if another SEO plugin attempts to index them.
        if (get_query_var('bsms_portal_section')) $noindex = true;
        if ($noindex) {
            $robots['noindex'] = true;
            $robots['follow'] = true;
            unset($robots['index']);
        }
        return $robots;
    }

    public static function exclude_application_pages_from_sitemap($post_ids){
        $post_ids = is_array($post_ids) ? $post_ids : array();
        $slugs = array('login','register','forgot-password','payment-status', self::portal_slug());
        foreach ($slugs as $slug) {
            $page = get_page_by_path($slug, OBJECT, 'page');
            if ($page && !in_array((int)$page->ID, $post_ids, true)) $post_ids[] = (int)$page->ID;
        }
        return $post_ids;
    }

    public static function portal_url(){
        return home_url('/' . self::portal_slug() . '/');
    }


    public static function filter_login_url($login_url, $redirect='', $force_reauth=false){
        $url = self::auth_page_url('login');
        if ($redirect) $url = add_query_arg('redirect_to', rawurlencode($redirect), $url);
        if ($force_reauth) $url = add_query_arg('reauth', '1', $url);
        return $url;
    }

    public static function filter_register_url($register_url){
        return self::auth_page_url('register');
    }

    public static function filter_lostpassword_url($lostpassword_url, $redirect=''){
        $url = self::auth_page_url('forgot');
        if ($redirect) $url = add_query_arg('redirect_to', rawurlencode($redirect), $url);
        return $url;
    }

    public static function filter_reset_password_message($message, $key, $user_login, $user_data){
        $reset_url = add_query_arg(array(
            'action' => 'reset',
            'key' => rawurlencode($key),
            'login' => rawurlencode($user_login),
        ), self::auth_page_url('forgot'));
        $brand = BSMS_Util::brand_name();
        return "Someone requested a password reset for your {$brand} account.\n\nUsername: {$user_login}\n\nReset your password here:\n{$reset_url}\n\nIf you did not request this, you can safely ignore this email.";
    }

    public static function maybe_hide_admin_bar($show){
        if (is_user_logged_in() && !self::can_manage()) return false;
        return $show;
    }

    public static function protect_wp_admin(){
        if (!is_user_logged_in()) return;
        if (self::can_manage()) return;
        if (defined('DOING_AJAX') && DOING_AJAX) return;
        wp_safe_redirect(self::portal_url());
        exit;
    }

    public static function redirect_after_auth(){
        $redirect = isset($_REQUEST['redirect_to']) ? esc_url_raw(wp_unslash($_REQUEST['redirect_to'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Where to go after signing in; cleaned with esc_url_raw() and checked by wp_validate_redirect().
        if (!$redirect) $redirect = self::portal_url();
        return $redirect;
    }

    public static function recaptcha_enabled_for($action){
        if (!intval(get_option('bsms_recaptcha_enabled', 0))) return false;
        if (!trim((string)get_option('bsms_recaptcha_site_key', '')) || !trim((string)get_option('bsms_recaptcha_secret_key', ''))) return false;
        $map = array(
            'login' => 'bsms_recaptcha_apply_login',
            'register' => 'bsms_recaptcha_apply_register',
            'forgot' => 'bsms_recaptcha_apply_forgot',
            'reset' => 'bsms_recaptcha_apply_forgot',
        );
        $key = isset($map[$action]) ? $map[$action] : '';
        return $key ? (bool)intval(get_option($key, 1)) : false;
    }

    public static function enqueue_recaptcha_if_needed(){
        if (!intval(get_option('bsms_recaptcha_enabled', 0))) return;
        if (!trim((string)get_option('bsms_recaptcha_site_key', ''))) return;
        wp_enqueue_script('google-recaptcha', 'https://www.google.com/recaptcha/api.js', array(), null, true); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion -- Google serves this script; a version would not change it.
    }

    public static function recaptcha_widget($action){
        if (!self::recaptcha_enabled_for($action)) return '';
        self::enqueue_recaptcha_if_needed();
        return '<div class="bsms-recaptcha-wrap"><div class="g-recaptcha" data-sitekey="' . esc_attr(get_option('bsms_recaptcha_site_key', '')) . '"></div></div>';
    }

    public static function auth_security_fields($action){
        $html = '<input type="hidden" name="bsms_form_loaded_at" value="' . esc_attr(time()) . '">';
        if (intval(get_option('bsms_auth_honeypot_enabled', 1))) {
            $html .= '<label class="bsms-hp-field" aria-hidden="true">' . esc_html__('Leave this field empty', 'bulk-sms-portal') . '<input type="text" name="bsms_company_url" value="" tabindex="-1" autocomplete="off"></label>';
        }
        return $html;
    }

    public static function auth_recaptcha_field($action){
        return self::recaptcha_widget($action);
    }

    public static function comment_recaptcha_enabled(){
        return (bool)(intval(get_option('bsms_recaptcha_enabled', 0)) && trim((string)get_option('bsms_recaptcha_site_key', '')) && trim((string)get_option('bsms_recaptcha_secret_key', '')));
    }

    public static function add_recaptcha_to_comment_form($defaults){
        if (!self::comment_recaptcha_enabled()) return $defaults;
        self::enqueue_recaptcha_if_needed();
        $site_key = get_option('bsms_recaptcha_site_key', '');
        $captcha = '<div class="bsms-comment-recaptcha"><div class="g-recaptcha" data-sitekey="' . esc_attr($site_key) . '"></div></div>';
        $defaults['comment_notes_after'] = ($defaults['comment_notes_after'] ?? '') . $captcha;
        return $defaults;
    }

    public static function verify_comment_recaptcha($commentdata){
        if (!self::comment_recaptcha_enabled()) return $commentdata;
        $token = sanitize_text_field(wp_unslash($_POST['g-recaptcha-response'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checked with Google reCAPTCHA; the form nonce is verified by the caller.
        if (!$token) {
            wp_die(esc_html__('Please complete the reCAPTCHA check before submitting your comment.', 'bulk-sms-portal'), esc_html__('Comment security check required', 'bulk-sms-portal'), array('response' => 403, 'back_link' => true));
        }
        $response = wp_remote_post('https://www.google.com/recaptcha/api/siteverify', array(
            'timeout' => 12,
            'body' => array(
                'secret' => get_option('bsms_recaptcha_secret_key', ''),
                'response' => $token,
                'remoteip' => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '',
            ),
        ));
        $body = is_wp_error($response) ? array() : json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body['success'])) {
            if (class_exists('BSMS_Security')) BSMS_Security::log('comment_recaptcha_failed', 'Google reCAPTCHA verification failed on comment form');
            wp_die(esc_html__('reCAPTCHA verification failed. Please go back and try again.', 'bulk-sms-portal'), esc_html__('Comment security check failed', 'bulk-sms-portal'), array('response' => 403, 'back_link' => true));
        }
        return $commentdata;
    }

    public static function verify_auth_security($action){
        if (intval(get_option('bsms_auth_honeypot_enabled', 1)) && !empty($_POST['bsms_company_url'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Called only after the form nonce is verified.
            if (class_exists('BSMS_Security')) BSMS_Security::log('auth_honeypot_blocked', 'Auth submission blocked by honeypot');
            return new WP_Error('bsms_honeypot', __('Security check failed. Please try again.', 'bulk-sms-portal'));
        }
        $min_seconds = max(0, intval(get_option('bsms_auth_min_form_seconds', 2)));
        if ($min_seconds > 0) {
            $loaded = intval($_POST['bsms_form_loaded_at'] ?? 0); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Called only after the form nonce is verified.
            if (!$loaded || (time() - $loaded) < $min_seconds) {
                if (class_exists('BSMS_Security')) BSMS_Security::log('auth_too_fast_blocked', 'Auth submission blocked by minimum form time');
                return new WP_Error('bsms_too_fast', __('Please wait a moment and try again.', 'bulk-sms-portal'));
            }
        }
        if (!self::recaptcha_enabled_for($action)) return true;
        $token = sanitize_text_field(wp_unslash($_POST['g-recaptcha-response'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Missing -- Checked with Google reCAPTCHA; the form nonce is verified by the caller.
        if (!$token) return new WP_Error('bsms_recaptcha_missing', __('Please complete the reCAPTCHA check.', 'bulk-sms-portal'));
        $response = wp_remote_post('https://www.google.com/recaptcha/api/siteverify', array(
            'timeout' => 12,
            'body' => array(
                'secret' => get_option('bsms_recaptcha_secret_key', ''),
                'response' => $token,
                'remoteip' => isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : '',
            ),
        ));
        if (is_wp_error($response)) return new WP_Error('bsms_recaptcha_error', __('reCAPTCHA verification could not be completed. Please try again.', 'bulk-sms-portal'));
        $body = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($body['success'])) {
            if (class_exists('BSMS_Security')) BSMS_Security::log('auth_recaptcha_failed', 'Google reCAPTCHA verification failed');
            return new WP_Error('bsms_recaptcha_failed', __('reCAPTCHA verification failed. Please try again.', 'bulk-sms-portal'));
        }
        return true;
    }

    public static function maybe_handle_auth_forms(){
        if (empty($_POST['bsms_auth_action'])) return;
        $action = sanitize_key(wp_unslash($_POST['bsms_auth_action']));

        if ($action === 'login') {
            if (!isset($_POST['bsms_login_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['bsms_login_nonce'])), 'bsms_frontend_login')) {
                self::auth_redirect_with_message('login', __('Security check failed. Please try again.', 'bulk-sms-portal'), 'error');
            }
            $security = self::verify_auth_security('login');
            if (is_wp_error($security)) self::auth_redirect_with_message('login', $security->get_error_message(), 'error');
            $creds = array(
                'user_login' => sanitize_text_field(wp_unslash($_POST['log'] ?? '')),
                'user_password' => (string)wp_unslash($_POST['pwd'] ?? ''), // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Passwords are not altered; WordPress checks them.
                'remember' => !empty($_POST['rememberme']),
            );
            $user = wp_signon($creds, is_ssl());
            if (is_wp_error($user)) {
                self::auth_redirect_with_message('login', __('Invalid login details. Please check your username/email and password.', 'bulk-sms-portal'), 'error');
            }
            wp_safe_redirect(self::redirect_after_auth());
            exit;
        }

        if ($action === 'register') {
            if (!isset($_POST['bsms_register_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['bsms_register_nonce'])), 'bsms_frontend_register')) {
                self::auth_redirect_with_message('register', __('Security check failed. Please try again.', 'bulk-sms-portal'), 'error');
            }
            $security = self::verify_auth_security('register');
            if (is_wp_error($security)) self::auth_redirect_with_message('register', $security->get_error_message(), 'error');
            if (!get_option('users_can_register')) {
                self::auth_redirect_with_message('register', __('Registration is currently disabled. Please contact support.', 'bulk-sms-portal'), 'error');
            }
            $email = sanitize_email(wp_unslash($_POST['user_email'] ?? ''));
            $username = sanitize_user(wp_unslash($_POST['user_login'] ?? ''), true);
            $password = (string)wp_unslash($_POST['user_pass'] ?? ''); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Passwords are not altered; WordPress hashes them.
            $confirm = (string)wp_unslash($_POST['user_pass_confirm'] ?? ''); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Passwords are not altered; only compared.
            if (!$email || !is_email($email)) self::auth_redirect_with_message('register', __('Please enter a valid email address.', 'bulk-sms-portal'), 'error');
            if (!$username) $username = sanitize_user(current(explode('@', $email)), true);
            if (!$username) self::auth_redirect_with_message('register', __('Please enter a valid username.', 'bulk-sms-portal'), 'error');
            if (username_exists($username) || email_exists($email)) self::auth_redirect_with_message('register', __('An account already exists with those details.', 'bulk-sms-portal'), 'error');
            if (strlen($password) < 8) self::auth_redirect_with_message('register', __('Password must be at least 8 characters.', 'bulk-sms-portal'), 'error');
            if ($password !== $confirm) self::auth_redirect_with_message('register', __('Passwords do not match.', 'bulk-sms-portal'), 'error');
            $user_id = wp_create_user($username, $password, $email);
            if (is_wp_error($user_id)) self::auth_redirect_with_message('register', $user_id->get_error_message(), 'error');
            $default_role = get_option('default_role', 'customer');
            if (!get_role($default_role)) $default_role = get_role('customer') ? 'customer' : 'bsms_customer';
            wp_update_user(array('ID'=>$user_id, 'role'=>$default_role));
            update_user_meta($user_id, 'bsms_notification_prefs', array('email_newsletter'=>!empty($_POST['bsms_newsletter_consent']) ? 1 : 0));
            if (class_exists('BSMS_Mailings')) BSMS_Mailings::welcome($user_id);
            $registered_user = new WP_User($user_id);
            foreach (self::portal_customer_capabilities() as $cap) $registered_user->add_cap($cap);
            $user = get_user_by('id', $user_id);
            wp_set_current_user($user_id, $user->user_login);
            wp_set_auth_cookie($user_id, true, is_ssl());
            do_action('wp_login', $user->user_login, $user); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core WordPress hook, fired after a successful sign-in.
            $registration_redirect = isset($_POST['redirect_to']) ? esc_url_raw(wp_unslash($_POST['redirect_to'])) : '';
            wp_safe_redirect($registration_redirect ?: self::portal_url());
            exit;
        }

        if ($action === 'forgot') {
            if (!isset($_POST['bsms_forgot_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['bsms_forgot_nonce'])), 'bsms_frontend_forgot')) {
                self::auth_redirect_with_message('forgot', __('Security check failed. Please try again.', 'bulk-sms-portal'), 'error');
            }
            $security = self::verify_auth_security('forgot');
            if (is_wp_error($security)) self::auth_redirect_with_message('forgot', $security->get_error_message(), 'error');
            $login = sanitize_text_field(wp_unslash($_POST['user_login'] ?? ''));
            if (!$login) self::auth_redirect_with_message('forgot', __('Please enter your username or email address.', 'bulk-sms-portal'), 'error');
            $_POST['user_login'] = $login;
            $result = retrieve_password();
            if (is_wp_error($result)) self::auth_redirect_with_message('forgot', $result->get_error_message(), 'error');
            self::auth_redirect_with_message('login', __('Password reset instructions have been sent if the account exists.', 'bulk-sms-portal'), 'success');
        }

        if ($action === 'reset') {
            if (!isset($_POST['bsms_reset_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['bsms_reset_nonce'])), 'bsms_frontend_reset')) {
                self::auth_redirect_with_message('forgot', __('Security check failed. Please try again.', 'bulk-sms-portal'), 'error');
            }
            $security = self::verify_auth_security('reset');
            if (is_wp_error($security)) self::auth_redirect_with_message('forgot', $security->get_error_message(), 'error');
            $login = sanitize_text_field(wp_unslash($_POST['user_login'] ?? ''));
            $key = sanitize_text_field(wp_unslash($_POST['reset_key'] ?? ''));
            $pass1 = (string)wp_unslash($_POST['pass1'] ?? ''); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Passwords are not altered; WordPress hashes them.
            $pass2 = (string)wp_unslash($_POST['pass2'] ?? ''); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Passwords are not altered; only compared.
            if (strlen($pass1) < 8) self::auth_redirect_with_message('forgot', __('Password must be at least 8 characters.', 'bulk-sms-portal'), 'error');
            if ($pass1 !== $pass2) self::auth_redirect_with_message('forgot', __('Passwords do not match.', 'bulk-sms-portal'), 'error');
            $user = check_password_reset_key($key, $login);
            if (is_wp_error($user)) self::auth_redirect_with_message('forgot', __('The password reset link is invalid or has expired. Please request a new one.', 'bulk-sms-portal'), 'error');
            reset_password($user, $pass1);
            self::auth_redirect_with_message('login', __('Password updated successfully. You can now log in.', 'bulk-sms-portal'), 'success');
        }
    }

    public static function auth_redirect_with_message($page, $message, $type='info'){
        $args = array(
            'bsms_auth_msg' => rawurlencode($message),
            'bsms_auth_type' => sanitize_key($type),
        );
        $redirect = isset($_REQUEST['redirect_to']) ? esc_url_raw(wp_unslash($_REQUEST['redirect_to'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Where to go after signing in; cleaned with esc_url_raw() and checked by wp_validate_redirect().
        if ($redirect) $args['redirect_to'] = $redirect;
        $url = add_query_arg($args, self::auth_page_url($page));
        wp_safe_redirect($url);
        exit;
    }

    /* ------------------------------------------------------------------
     * Sign-in pages (v3.8.1 redesign). Drawn with the portal design system
     * (.bx, assets/portal-ui.css): a focused form on the left and, on wide
     * screens, a panel that shows what the account is for.
     * ------------------------------------------------------------------ */

    /** Notice passed back after a form is sent (?bsms_auth_msg=...). */
    public static function auth_message_html(){
        if (empty($_GET['bsms_auth_msg'])) return ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only notice shown on the page.
        $type = sanitize_key(wp_unslash($_GET['bsms_auth_type'] ?? 'info')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only notice shown on the page.
        $msg = sanitize_text_field(wp_unslash($_GET['bsms_auth_msg'])); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only notice shown on the page.
        $tone = array('error'=>'is-bad', 'success'=>'is-good', 'warning'=>'is-wait')[$type] ?? 'is-info';
        return '<div class="bx-note ' . esc_attr($tone) . '" role="' . ($tone === 'is-bad' ? 'alert' : 'status') . '"><span>' . esc_html($msg) . '</span></div>';
    }

    public static function auth_brand_html(){
        $logo = method_exists('BSMS_Util', 'logo_url') ? BSMS_Util::logo_url() : '';
        $name = class_exists('BSMS_Util') ? BSMS_Util::brand_name() : get_bloginfo('name');
        $initial = function_exists('mb_substr') ? mb_substr($name, 0, 1) : substr($name, 0, 1);
        $logo_html = $logo ? '<img src="' . esc_url($logo) . '" alt="' . esc_attr($name) . '">' : '<span>' . esc_html($initial) . '</span>';
        return '<div class="bsms-auth-brand">' . $logo_html . '<strong>' . esc_html($name) . '</strong></div>';
    }

    /** Brand mark for the sign-in pages: logo, or the first letter in a tile. */
    private static function auth_mark_html(){
        $logo = method_exists('BSMS_Util', 'logo_url') ? BSMS_Util::logo_url() : '';
        $name = BSMS_Util::brand_name();
        $initial = function_exists('mb_substr') ? mb_substr($name, 0, 1) : substr($name, 0, 1);
        $mark = $logo ? '<img src="' . esc_url($logo) . '" alt="">' : '<span class="bx-auth-tile" aria-hidden="true">' . esc_html($initial) . '</span>';
        return '<a class="bx-auth-brand" href="' . esc_url(home_url('/')) . '">' . $mark . '<strong>' . esc_html($name) . '</strong></a>';
    }

    /** Everything the sign-in pages need: the design system and the small password toggle. */
    private static function auth_assets(){
        if (!wp_style_is('bsms-portal-ui', 'registered')) self::assets();
        wp_enqueue_style('bsms-portal');
        wp_enqueue_style('bsms-portal-ui');
        wp_enqueue_script('bsms-portal');
    }

    private static function auth_field($label, $input, $hint = ''){
        return '<label class="bx-field"><span class="bx-label">' . esc_html($label) . '</span>' . $input . ($hint !== '' ? '<span class="bx-hint">' . esc_html($hint) . '</span>' : '') . '</label>';
    }

    public static function render_access_required(){
        self::auth_assets();
        $body = '<div class="bx-auth-actions">'
            . '<a class="bx-btn is-primary is-block is-large" href="' . esc_url(self::auth_page_url('login')) . '">' . esc_html__('Sign in', 'bulk-sms-portal') . '</a>'
            . '<a class="bx-btn is-block is-large" href="' . esc_url(self::auth_page_url('register')) . '">' . esc_html__('Create an account', 'bulk-sms-portal') . '</a></div>';
        /* translators: %s: the site's brand name */
        $lede = sprintf(__('Sign in to your %s account to send messages, add money and see your results.', 'bulk-sms-portal'), BSMS_Util::brand_name());
        return self::render_auth_shell(__('Sign in to continue', 'bulk-sms-portal'), $body, $lede, 'account');
    }

    /**
     * The page around every sign-in form.
     * $mode: login | register | forgot | reset | account.
     */
    public static function render_auth_shell($title, $body, $subtitle = '', $mode = 'account'){
        self::auth_assets();
        $brand = BSMS_Util::brand_name();
        if (is_user_logged_in() && $mode !== 'account') {
            $title = __('You are already signed in', 'bulk-sms-portal');
            $subtitle = __('Carry on in your account, or buy more SMS.', 'bulk-sms-portal');
            $body = '<div class="bx-auth-actions">'
                . '<a class="bx-btn is-primary is-block is-large" href="' . esc_url(self::portal_url()) . '">' . esc_html__('Open my account', 'bulk-sms-portal') . '</a>'
                . '<a class="bx-btn is-block is-large" href="' . esc_url(self::auth_page_url('buy')) . '">' . esc_html__('Buy SMS', 'bulk-sms-portal') . '</a></div>';
            $mode = 'account';
        }
        $wide = in_array($mode, array('login', 'register'), true);
        $form = '<section class="bx-auth-card" aria-labelledby="bx-auth-title">'
            . self::auth_mark_html()
            . '<h1 id="bx-auth-title" class="bx-auth-title">' . esc_html($title) . '</h1>'
            . ($subtitle !== '' ? '<p class="bx-auth-lede">' . esc_html($subtitle) . '</p>' : '')
            . self::auth_message_html()
            . $body
            . '</section>';
        $panel = $wide ? self::auth_panel_html($mode, $brand) : '';
        $html = '<div class="bx bx-auth' . ($wide ? ' has-panel' : '') . ' is-' . esc_attr($mode) . '" style="' . esc_attr(BSMS_Util::design_style_attr()) . '">'
            . '<div class="bx-auth-grid">' . $form . $panel . '</div></div>';
        return self::theme_owns_public_pages() ? $html : '<div class="bsms-auth-page alignwide">' . $html . '</div>';
    }

    /** Right-hand panel: what customers see (sign in) or the steps to a first message (register). */
    private static function auth_panel_html($mode, $brand){
        if ($mode === 'register') {
            $steps = array(
                array(__('Create your account', 'bulk-sms-portal'), __('It takes a minute. No card needed.', 'bulk-sms-portal')),
                array(__('Add money to your wallet', 'bulk-sms-portal'), __('Pay online or by bank transfer. Everything you pay is credited.', 'bulk-sms-portal')),
                array(__('Get a sender name', 'bulk-sms-portal'), __('The name people see your messages from. We check it before first use.', 'bulk-sms-portal')),
                array(__('Send your first message', 'bulk-sms-portal'), __('See the cost before you send, and the result after.', 'bulk-sms-portal')),
            );
            $items = '';
            foreach ($steps as $i => $s) {
                $items .= '<li><span class="bx-auth-num" aria-hidden="true">' . intval($i + 1) . '</span><div><strong>' . esc_html($s[0]) . '</strong><span>' . esc_html($s[1]) . '</span></div></li>';
            }
            return '<aside class="bx-auth-panel" aria-label="' . esc_attr__('How it works', 'bulk-sms-portal') . '">'
                . '<h2>' . esc_html__('From sign-up to first message', 'bulk-sms-portal') . '</h2>'
                . '<ol class="bx-auth-steps">' . $items . '</ol></aside>';
        }
        $thread = array(
            array('SCHOOLNEWS', __('PTA meeting holds this Saturday at 10am in the main hall.', 'bulk-sms-portal'), 'is-good', __('Successful', 'bulk-sms-portal')),
            array('FRESHMART', __('Your order is ready for pick-up. Show code 4821 at the counter.', 'bulk-sms-portal'), 'is-good', __('Successful', 'bulk-sms-portal')),
            array('CLINICCARE', __('Reminder: your appointment is tomorrow at 9:30am.', 'bulk-sms-portal'), 'is-wait', __('Sending', 'bulk-sms-portal')),
        );
        $bubbles = '';
        foreach ($thread as $m) {
            $bubbles .= '<li class="bx-auth-sms"><span class="bx-auth-from">' . esc_html($m[0]) . '</span><p>' . esc_html($m[1]) . '</p><span class="bx-pill ' . esc_attr($m[2]) . '">' . esc_html($m[3]) . '</span></li>';
        }
        return '<aside class="bx-auth-panel" aria-label="' . esc_attr__('Example messages', 'bulk-sms-portal') . '">'
            /* translators: %s: the site's brand name */
            . '<h2>' . esc_html(sprintf(__('Messages sent with %s', 'bulk-sms-portal'), $brand)) . '</h2>'
            . '<p>' . esc_html__('Every message shows its result, and failed ones are refunded to your wallet.', 'bulk-sms-portal') . '</p>'
            . '<ul class="bx-auth-thread">' . $bubbles . '</ul></aside>';
    }

    public static function password_field_html($name, $label, $autocomplete, $confirm=false){
        $id = 'bsms-' . sanitize_html_class($name);
        return '<label class="bx-field" for="' . esc_attr($id) . '"><span class="bx-label">' . esc_html($label) . '</span>'
            . '<span class="bx-auth-password"><input class="bx-input" id="' . esc_attr($id) . '" type="password" name="' . esc_attr($name) . '" autocomplete="' . esc_attr($autocomplete) . '" minlength="' . ($autocomplete === 'new-password' ? '8' : '1') . '" required>'
            . '<button type="button" class="bx-auth-toggle" data-password-toggle="' . esc_attr($id) . '" data-show="' . esc_attr__('Show', 'bulk-sms-portal') . '" data-hide="' . esc_attr__('Hide', 'bulk-sms-portal') . '" data-show-label="' . esc_attr__('Show password', 'bulk-sms-portal') . '" data-hide-label="' . esc_attr__('Hide password', 'bulk-sms-portal') . '" aria-label="' . esc_attr__('Show password', 'bulk-sms-portal') . '" aria-pressed="false">' . esc_html__('Show', 'bulk-sms-portal') . '</button></span></label>';
    }

    /** Hidden fields and spam checks shared by every sign-in form. */
    private static function auth_form_open($action, $nonce_action, $nonce_name, $extra = ''){
        return '<form method="post" class="bx-auth-form bsms-auth-form" novalidate>'
            . '<input type="hidden" name="bsms_auth_action" value="' . esc_attr($action) . '">'
            . $extra
            . wp_nonce_field($nonce_action, $nonce_name, true, false)
            . self::auth_security_fields($action);
    }

    public static function render_login(){
        $redirect = self::redirect_after_auth();
        $register = self::auth_page_url('register');
        $forgot = self::auth_page_url('forgot');
        if (!empty($_GET['redirect_to'])) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Where to go after signing in; cleaned before use.
            $intent = esc_url_raw(wp_unslash($_GET['redirect_to'])); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Where to go after signing in; cleaned before use.
            if ($intent) $register = add_query_arg('redirect_to', $intent, $register);
        }
        $body = self::auth_form_open('login', 'bsms_frontend_login', 'bsms_login_nonce', '<input type="hidden" name="redirect_to" value="' . esc_attr($redirect) . '">')
            . self::auth_field(__('Username or email address', 'bulk-sms-portal'), '<input class="bx-input" type="text" name="log" autocomplete="username" required>')
            . self::password_field_html('pwd', __('Password', 'bulk-sms-portal'), 'current-password')
            . '<div class="bx-auth-row"><label class="bx-check"><input type="checkbox" name="rememberme" value="1"><span>' . esc_html__('Keep me signed in', 'bulk-sms-portal') . '</span></label>'
            . '<a class="bx-link" href="' . esc_url($forgot) . '">' . esc_html__('Forgot password?', 'bulk-sms-portal') . '</a></div>'
            . self::auth_recaptcha_field('login')
            . '<button type="submit" class="bx-btn is-primary is-block is-large">' . esc_html__('Sign in', 'bulk-sms-portal') . '</button>'
            . '</form>'
            . '<p class="bx-auth-switch">' . esc_html__('New here?', 'bulk-sms-portal') . ' <a class="bx-link" href="' . esc_url($register) . '">' . esc_html__('Create an account', 'bulk-sms-portal') . '</a></p>';
        /* translators: %s: the site's brand name */
        $lede = sprintf(__('Use the details you signed up to %s with.', 'bulk-sms-portal'), BSMS_Util::brand_name());
        return self::render_auth_shell(__('Sign in', 'bulk-sms-portal'), $body, $lede, 'login');
    }

    public static function render_register(){
        $login = self::auth_page_url('login');
        $intent = !empty($_GET['redirect_to']) ? esc_url_raw(wp_unslash($_GET['redirect_to'])) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Where to go after signing in; cleaned before use.
        if ($intent) $login = add_query_arg('redirect_to', $intent, $login);
        if (!get_option('users_can_register')) {
            $body = '<div class="bx-note is-wait" role="status"><span><strong>' . esc_html__('New accounts are paused', 'bulk-sms-portal') . '</strong>' . esc_html__('Please contact us if you need an account opened.', 'bulk-sms-portal') . '</span></div>'
                . '<p class="bx-auth-switch"><a class="bx-link" href="' . esc_url($login) . '">' . esc_html__('Back to sign in', 'bulk-sms-portal') . '</a></p>';
            return self::render_auth_shell(__('Create an account', 'bulk-sms-portal'), $body, '', 'paused');
        }
        $brand = BSMS_Util::brand_name();
        $body = self::auth_form_open('register', 'bsms_frontend_register', 'bsms_register_nonce', $intent ? '<input type="hidden" name="redirect_to" value="' . esc_attr($intent) . '">' : '')
            . self::auth_field(__('Username', 'bulk-sms-portal'), '<input class="bx-input" type="text" name="user_login" autocomplete="username" required>', __('Letters and numbers. You can sign in with this or your email.', 'bulk-sms-portal'))
            . self::auth_field(__('Email address', 'bulk-sms-portal'), '<input class="bx-input" type="email" name="user_email" autocomplete="email" required>')
            . self::password_field_html('user_pass', __('Password', 'bulk-sms-portal'), 'new-password')
            . '<span class="bx-hint bx-auth-under">' . esc_html__('At least 8 characters. Longer is safer.', 'bulk-sms-portal') . '</span>'
            . self::password_field_html('user_pass_confirm', __('Type the password again', 'bulk-sms-portal'), 'new-password')
            . '<label class="bx-check"><input type="checkbox" name="bsms_newsletter_consent" value="1"><span>' . esc_html__('Email me occasional news and offers. I can turn this off in Notifications.', 'bulk-sms-portal') . '</span></label>'
            . self::auth_recaptcha_field('register')
            . '<button type="submit" class="bx-btn is-primary is-block is-large">' . esc_html__('Create my account', 'bulk-sms-portal') . '</button>'
            /* translators: %s: the site's brand name */
            . '<p class="bx-hint">' . esc_html(sprintf(__('Only send messages to people who have agreed to hear from you. By creating an account you agree to use %s responsibly.', 'bulk-sms-portal'), $brand)) . '</p>'
            . '</form>'
            . '<p class="bx-auth-switch">' . esc_html__('Already have an account?', 'bulk-sms-portal') . ' <a class="bx-link" href="' . esc_url($login) . '">' . esc_html__('Sign in', 'bulk-sms-portal') . '</a></p>';
        return self::render_auth_shell(__('Create your account', 'bulk-sms-portal'), $body, __('Buy SMS, send messages and see every result in one place.', 'bulk-sms-portal'), 'register');
    }

    public static function render_forgot_password(){
        $login_url = self::auth_page_url('login');
        $action = sanitize_key(wp_unslash($_GET['action'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Password reset link from email; the reset key is checked by WordPress.
        $key = sanitize_text_field(wp_unslash($_GET['key'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Password reset link from email; the reset key is checked by WordPress.
        $login = sanitize_text_field(wp_unslash($_GET['login'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Password reset link from email; the reset key is checked by WordPress.
        $back = '<p class="bx-auth-switch"><a class="bx-link" href="' . esc_url($login_url) . '">' . esc_html__('Back to sign in', 'bulk-sms-portal') . '</a></p>';

        if ($action === 'reset' && $key && $login) {
            $checked = check_password_reset_key($key, $login);
            if (is_wp_error($checked)) {
                $body = '<div class="bx-note is-bad" role="alert"><span><strong>' . esc_html__('This link can no longer be used', 'bulk-sms-portal') . '</strong>' . esc_html__('It may have expired or been used already. Ask for a new one below.', 'bulk-sms-portal') . '</span></div>'
                    . '<div class="bx-auth-actions"><a class="bx-btn is-primary is-block is-large" href="' . esc_url(self::auth_page_url('forgot')) . '">' . esc_html__('Send me a new link', 'bulk-sms-portal') . '</a></div>' . $back;
                return self::render_auth_shell(__('Reset link expired', 'bulk-sms-portal'), $body, '', 'forgot');
            }
            $body = self::auth_form_open('reset', 'bsms_frontend_reset', 'bsms_reset_nonce', '<input type="hidden" name="reset_key" value="' . esc_attr($key) . '"><input type="hidden" name="user_login" value="' . esc_attr($login) . '">')
                . self::password_field_html('pass1', __('New password', 'bulk-sms-portal'), 'new-password')
                . '<span class="bx-hint bx-auth-under">' . esc_html__('At least 8 characters. Do not reuse a password from another site.', 'bulk-sms-portal') . '</span>'
                . self::password_field_html('pass2', __('Type the new password again', 'bulk-sms-portal'), 'new-password')
                . self::auth_recaptcha_field('reset')
                . '<button type="submit" class="bx-btn is-primary is-block is-large">' . esc_html__('Save new password', 'bulk-sms-portal') . '</button>'
                . '</form>' . $back;
            return self::render_auth_shell(__('Choose a new password', 'bulk-sms-portal'), $body, __('You will sign in with it straight away.', 'bulk-sms-portal'), 'reset');
        }

        $body = self::auth_form_open('forgot', 'bsms_frontend_forgot', 'bsms_forgot_nonce')
            . self::auth_field(__('Username or email address', 'bulk-sms-portal'), '<input class="bx-input" type="text" name="user_login" autocomplete="username" required>')
            . self::auth_recaptcha_field('forgot')
            . '<button type="submit" class="bx-btn is-primary is-block is-large">' . esc_html__('Email me a reset link', 'bulk-sms-portal') . '</button>'
            . '</form>' . $back;
        return self::render_auth_shell(__('Forgot your password?', 'bulk-sms-portal'), $body, __('If the details match an account, we will email a private link to set a new password.', 'bulk-sms-portal'), 'forgot');
    }

    public static function render_auth_links(){
        wp_enqueue_style('bsms-portal');
        if (is_user_logged_in()) {
            return '<div class="bsms-auth-actions"><a class="bsms-btn bsms-btn-primary" href="' . esc_url(self::portal_url()) . '">Open Portal</a></div>';
        }
        return '<div class="bsms-auth-actions"><a class="bsms-btn bsms-btn-primary" href="' . esc_url(self::auth_page_url('login')) . '">Login</a><a class="bsms-btn bsms-btn-outline" href="' . esc_url(self::auth_page_url('register')) . '">Create Account</a></div>';
    }

    /**
     * A theme that draws the public pages itself (pricing, buy SMS, help) can
     * say so with the bsms_theme_owns_public_pages filter; the plugin then
     * leaves those pages to the theme. The portal, sign-in and payments are
     * unchanged.
     */
    public static function theme_owns_public_pages(){
        return (bool) apply_filters('bsms_theme_owns_public_pages', false);
    }

    /** Public URLs and data for theme/Elementor; no plugin-owned site chrome. */
    public static function public_integration(){
        return array(
            'theme_owns_public_pages' => self::theme_owns_public_pages(),
            'authenticated' => is_user_logged_in(),
            'portal' => self::portal_url(),
            'login' => self::auth_page_url('login'),
            'register' => self::auth_page_url('register'),
            'forgot_password' => self::auth_page_url('forgot'),
            'pricing' => self::auth_page_url('pricing'),
            'buy_sms' => self::auth_page_url('buy'),
            'help' => self::auth_page_url('help'),
            'payment_status' => self::auth_page_url('payment'),
            'rates_kobo' => self::public_rate_summary(),
            'buying_rates' => self::public_buying_rates(),
            'network_rates' => self::public_network_rates(),
            'price_list' => self::public_price_list(),
            'purchase_review_url' => self::auth_page_url('buy'),
            'purchase_quote_callback' => array(__CLASS__, 'public_purchase_quote'),
            'payment_target_callback' => array(__CLASS__, 'public_payment_target'),
        );
    }

    /** A small, optional Elementor/WordPress component, not a page layout. */
    public static function render_live_rates($atts=array()){
        $rates = self::public_rate_summary();
        $labels = array('normal'=>__('Standard SMS', 'bulk-sms-portal'), 'dnd'=>'DND SMS', 'international'=>__('International SMS', 'bulk-sms-portal'));
        $html = ('<div class="bsms-live-rates" role="region" aria-label="' . esc_attr__('Current SMS rates', 'bulk-sms-portal') . '"><table><caption>' . esc_html__('Current SMS rates', 'bulk-sms-portal') . '</caption><thead><tr><th scope="col">' . esc_html__('Service', 'bulk-sms-portal') . '</th><th scope="col">' . esc_html__('Rate', 'bulk-sms-portal') . '</th></tr></thead><tbody>');
        $count = 0;
        foreach ($labels as $key=>$label) {
            if ($key === 'international' && !self::international_public_available()) continue;
            if (!isset($rates[$key]) || (int)$rates[$key] <= 0) continue;
            $html .= '<tr><th scope="row">'.esc_html($label).'</th><td>'.esc_html(BSMS_Util::money((int)$rates[$key])).'</td></tr>';
            $count++;
        }
        $html .= ('</tbody></table><p>' . esc_html__('A standard GSM SMS is up to 160 characters. Longer or Unicode messages can use more than one SMS segment. Final charges may vary by destination, network and your account pricing; check the cost before sending.', 'bulk-sms-portal') . '</p></div>');
        return $count ? $html : ('<p>' . esc_html__('Current rates are available when you prepare a message.', 'bulk-sms-portal') . '</p>');
    }

    public static function ensure_public_pages($force=false){
        $key = 'bsms_public_pages_version';
        if (!$force && get_option($key) === BSMS_PRO_VERSION) return;
        $pages = array(
            'login' => array(__('Sign in', 'bulk-sms-portal'), '[bsms_login]'),
            'register' => array(__('Create account', 'bulk-sms-portal'), '[bsms_register]'),
            'forgot-password' => array(__('Forgot Password', 'bulk-sms-portal'), '[bsms_forgot_password]'),
            'buy-sms' => array(__('Buy SMS', 'bulk-sms-portal'), '[bsms_public_buy_sms]'),
            'help' => array(__('Help Centre', 'bulk-sms-portal'), '[bsms_help_centre]'),
            'payment-status' => array(__('Payment Status', 'bulk-sms-portal'), '[bsms_payment_status]'),
            'sms-pricing' => array(__('SMS Pricing', 'bulk-sms-portal'), '[bsms_public_pricing]'),
        );
        foreach ($pages as $slug=>$spec) {
            // Marketing pages are created and edited in WordPress/Elementor by the theme.
            // Do not recreate plugin-authored public pages on theme-owned installations.
            if (self::theme_owns_public_pages() && in_array($slug, array('buy-sms','help','sms-pricing'), true)) continue;
            $existing = get_page_by_path($slug, OBJECT, 'page');
            if ($existing) continue;
            $id = wp_insert_post(array(
                'post_title'=>$spec[0], 'post_name'=>$slug, 'post_content'=>$spec[1],
                'post_status'=>'publish', 'post_type'=>'page', 'comment_status'=>'closed'
            ), true);
            if (!is_wp_error($id) && $id) update_option('bsms_public_page_'.$slug, intval($id), false);
        }
        // v3.7.1: the customer portal page itself, unless a page already holds the portal.
        $has_portal = get_page_by_path(self::portal_slug(), OBJECT, 'page');
        if (!$has_portal) {
            global $wpdb;
            $has_portal = $wpdb->get_var("SELECT ID FROM {$wpdb->posts} WHERE post_type='page' AND post_status IN ('publish','private','draft') AND post_content LIKE '%[bsms_portal%' LIMIT 1");
        }
        if (!$has_portal) {
            $id = wp_insert_post(array('post_title'=>__('Portal', 'bulk-sms-portal'), 'post_name'=>self::portal_slug(), 'post_content'=>'[bsms_portal]', 'post_status'=>'publish', 'post_type'=>'page', 'comment_status'=>'closed'), true);
            if (!is_wp_error($id) && $id) { update_option('bsms_public_page_portal', intval($id), false); }
        }
        update_option($key, BSMS_PRO_VERSION, false);
    }


    public static function public_nav_html($active=''){
        $items = array('pricing'=>__('Pricing', 'bulk-sms-portal'),'buy'=>__('Buy SMS', 'bulk-sms-portal'),'help'=>__('Help Centre', 'bulk-sms-portal'));
        if (is_user_logged_in()) $items['portal']=__('My Portal', 'bulk-sms-portal');
        else { $items['login']=__('Login', 'bulk-sms-portal'); $items['register']=__('Create Account', 'bulk-sms-portal'); }
        $html = ('<nav class="bsms-public-nav" aria-label="' . esc_attr__('Public navigation', 'bulk-sms-portal') . '">');
        foreach ($items as $key=>$label) {
            $url = $key === 'portal' ? self::portal_url() : self::auth_page_url($key);
            $html .= '<a class="'.($active===$key?'active':'').'" href="'.esc_url($url).'">'.esc_html($label).'</a>';
        }
        return $html.'</nav>';
    }

    public static function public_shell($active, $content, $wide=true){
        if (self::theme_owns_public_pages()) return $content;
        wp_enqueue_style('bsms-portal');
        $cls = $wide ? ' bsms-public-shell-wide alignwide' : '';
        return '<div class="bsms-public-shell bsms-design-scope'.$cls.'" style="'.esc_attr(BSMS_Util::design_style_attr()).'">'
            .'<header class="bsms-public-header">'.self::auth_brand_html().self::public_nav_html($active).'</header>'
            .'<main class="bsms-public-main">'.$content.'</main>'
            .'<footer class="bsms-public-footer"><span>© '.esc_html(wp_date('Y')).' '.esc_html(BSMS_Util::brand_name()).('</span><span>' . esc_html__('Secure messaging · Transparent pricing · Human support', 'bulk-sms-portal') . '</span></footer></div>');
    }

    private static function international_public_available(){
        $rate_available = false;
        if (class_exists('BSMS_Pricing') && method_exists('BSMS_Pricing','has_configured_route_rate')) {
            $rate_available = BSMS_Pricing::has_configured_route_rate('international');
        }

        $route_available = class_exists('BSMS_Providers') && BSMS_Providers::service_for_route('international') > 0;

        return (bool) apply_filters(
            'bsms_public_international_available',
            (class_exists('BSMS_Pricing') && BSMS_Pricing::international_service_ready() && count(BSMS_Pricing::price_list(0)) > 1)
        );
    }

    /**
     * Public prices for theme/Elementor presentation. From v3.6.2 there are
     * no quantity bands: this returns the one Nigeria price as a single row
     * ("Any size") so older theme templates keep working.
     */
    public static function public_buying_rates(){
        if (!class_exists('BSMS_Pricing')) return array();
        $k = BSMS_Pricing::flat_rate_for_quantity_kobo('normal', 1, '234');
        if (!$k) return array();
        return array(array('title'=>__('Nigeria', 'bulk-sms-portal'), 'min_qty'=>1, 'max_qty'=>0, 'price_minor'=>intval($k), 'band_label'=>__('Any size', 'bulk-sms-portal')));
    }

    /** v3.6.2: the whole public price list (Nigeria, its networks, other countries). */
    public static function public_price_list(){
        return class_exists('BSMS_Pricing') ? BSMS_Pricing::price_list(0) : array();
    }

    /** Public Nigeria network/route charges for the canonical pricing page. */
    public static function public_network_rates(){
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        if ($wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $t)) !== $t) return array();
        $rows = $wpdb->get_results("SELECT title,network,route,price_kobo FROM {$wpdb->prefix}bsms_pricing WHERE active=1 AND country_code='234' AND scope='network' AND network<>'all' ORDER BY network ASC, route ASC", ARRAY_A);
        $out = array();
        foreach ((array)$rows as $r) {
            $price = intval($r['price_kobo'] ?? 0);
            if ($price <= 0) continue;
            $route = class_exists('BSMS_Pricing') ? BSMS_Pricing::route($r['route'] ?? '') : sanitize_key($r['route'] ?? '');
            $out[] = array(
                'title' => sanitize_text_field((string)($r['title'] ?? '')),
                'network' => sanitize_text_field((string)($r['network'] ?? '')),
                'route' => $route,
                'price_minor' => $price,
            );
        }
        return $out;
    }

    /**
     * Public SMS calculator. The calculation is deliberately server-rendered so
     * it uses the same canonical sms_metrics() and pricing table as sending and
     * wallet charging rather than maintaining a second browser-only formula.
     */
    public static function render_sms_calculator(){
        wp_enqueue_style('bsms-portal');

        $message = '';
        $recipients = 1;
        $route = 'normal';
        $result = null;
        $submitted = false;

        if (isset($_POST['bsms_calc_action']) && sanitize_key(wp_unslash($_POST['bsms_calc_action'])) === 'calculate') {
            $submitted = true;
            $nonce = isset($_POST['bsms_calc_nonce']) ? sanitize_text_field(wp_unslash($_POST['bsms_calc_nonce'])) : '';
            if (!wp_verify_nonce($nonce, 'bsms_public_sms_calculator')) {
                $result = array('error' => __('The calculator session expired. Refresh the page and try again.', 'bulk-sms-portal'));
            } else {
                $message = isset($_POST['bsms_calc_message']) ? sanitize_textarea_field(wp_unslash($_POST['bsms_calc_message'])) : '';
                $recipients = isset($_POST['bsms_calc_recipients']) ? absint($_POST['bsms_calc_recipients']) : 1;
                $recipients = max(1, min(1000000, $recipients));
                $requested_route = isset($_POST['bsms_calc_route']) ? sanitize_key(wp_unslash($_POST['bsms_calc_route'])) : 'normal';
                $route = in_array($requested_route, array('normal','dnd'), true) ? $requested_route : 'normal';

                $metrics = BSMS_Util::sms_metrics($message);
                $segments_each = intval($metrics['pages'] ?? 0);
                $total_segments = $segments_each * $recipients;
                $rate_minor = null;
                if ($total_segments > 0 && class_exists('BSMS_Pricing')) {
                    $rate_minor = BSMS_Pricing::flat_rate_for_quantity_kobo($route, $total_segments, '234');
                }
                $rate_minor = $rate_minor !== null ? intval($rate_minor) : null;
                $cost_minor = ($rate_minor !== null && $rate_minor > 0) ? $total_segments * $rate_minor : null;
                $result = array(
                    'metrics' => $metrics,
                    'segments_each' => $segments_each,
                    'total_segments' => $total_segments,
                    'rate_minor' => $rate_minor,
                    'cost_minor' => $cost_minor,
                );
            }
        }

        $brand = BSMS_Util::brand_name();
        ob_start(); ?>
        <section class="bsms-sms-calculator" aria-labelledby="bsms-sms-calculator-title">
            <div class="bsms-calc-head">
                <span class="bsms-public-kicker"><?php esc_html_e('SMS calculator', 'bulk-sms-portal'); ?></span>
                <h2 id="bsms-sms-calculator-title"><?php esc_html_e('Check your message length and estimated cost', 'bulk-sms-portal'); ?></h2>
                <p>Enter your message and number of recipients. The calculator uses the same SMS length rules and current configured pricing as <?php echo esc_html($brand); ?>.</p>
            </div>
            <form method="post" class="bsms-calc-form">
                <?php wp_nonce_field('bsms_public_sms_calculator', 'bsms_calc_nonce'); ?>
                <input type="hidden" name="bsms_calc_action" value="calculate">
                <label class="bsms-calc-message"><span><?php esc_html_e('Message', 'bulk-sms-portal'); ?></span><textarea name="bsms_calc_message" rows="6" maxlength="5000" placeholder="<?php esc_attr_e('Type or paste your SMS message here…', 'bulk-sms-portal'); ?>" required><?php echo esc_textarea($message); ?></textarea></label>
                <div class="bsms-calc-fields">
                    <label><span><?php esc_html_e('Recipients', 'bulk-sms-portal'); ?></span><input type="number" name="bsms_calc_recipients" min="1" max="1000000" step="1" value="<?php echo esc_attr($recipients); ?>" required></label>
                    <label><span><?php esc_html_e('Delivery service', 'bulk-sms-portal'); ?></span><select name="bsms_calc_route"><option value="normal" <?php selected($route,'normal'); ?>><?php esc_html_e('Normal SMS', 'bulk-sms-portal'); ?></option><option value="dnd" <?php selected($route,'dnd'); ?>><?php esc_html_e('DND delivery', 'bulk-sms-portal'); ?></option></select></label>
                </div>
                <button type="submit" class="bsms-btn bsms-btn-primary"><?php esc_html_e('Calculate', 'bulk-sms-portal'); ?></button>
                <p class="bsms-calc-privacy"><?php esc_html_e('Your calculator text is used only to prepare this estimate. It is not sent as an SMS.', 'bulk-sms-portal'); ?></p>
            </form>
            <?php if ($submitted && is_array($result)): ?>
                <?php if (!empty($result['error'])): ?>
                    <div class="bsms-calc-notice" role="alert"><?php echo esc_html($result['error']); ?></div>
                <?php else: $m=$result['metrics']; ?>
                    <div class="bsms-calc-results" aria-live="polite">
                        <article><small><?php esc_html_e('Encoding', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html((string)$m['encoding']); ?></strong></article>
                        <article><small><?php esc_html_e('Characters', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(number_format_i18n(intval($m['length']))); ?></strong></article>
                        <article><small><?php esc_html_e('SMS per recipient', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(number_format_i18n(intval($result['segments_each']))); ?></strong></article>
                        <article><small><?php esc_html_e('Total SMS', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(number_format_i18n(intval($result['total_segments']))); ?></strong></article>
                        <article><small><?php esc_html_e('Rate per SMS', 'bulk-sms-portal'); ?></small><strong><?php echo ($result['rate_minor'] !== null && $result['rate_minor'] > 0) ? esc_html(BSMS_Util::money(intval($result['rate_minor']))) : esc_html__('Not configured', 'bulk-sms-portal'); ?></strong></article>
                        <article><small><?php esc_html_e('Estimated cost', 'bulk-sms-portal'); ?></small><strong><?php echo ($result['cost_minor'] !== null) ? esc_html(BSMS_Util::money(intval($result['cost_minor']))) : esc_html__('Unavailable', 'bulk-sms-portal'); ?></strong></article>
                    </div>
                    <p class="bsms-calc-note"><?php if (($m['encoding'] ?? '') === 'GSM-7'): ?><?php esc_html_e('Standard GSM-7 messages use up to 160 units for one SMS and 153 per part for longer messages. Some characters use two units.', 'bulk-sms-portal'); ?><?php else: ?><?php esc_html_e('This message contains Unicode characters. Unicode messages use up to 70 characters for one SMS and 67 per part for longer messages.', 'bulk-sms-portal'); ?><?php endif; ?> <?php esc_html_e('Final charges can vary where a different network, route or destination rate applies and are confirmed before sending.', 'bulk-sms-portal'); ?></p>
                <?php endif; ?>
            <?php endif; ?>
        </section>
        <?php return ob_get_clean();
    }

    public static function public_rate_summary(){
        $rows = array();
        if (class_exists('BSMS_Pricing')) {
            $normal = BSMS_Pricing::flat_rate_for_quantity_kobo('normal', 1, '234');
            $dnd = BSMS_Pricing::flat_rate_for_quantity_kobo('dnd', 1, '234');
            if ($normal !== null && intval($normal) > 0) $rows['normal']=intval($normal);
            if ($dnd !== null && intval($dnd) > 0) $rows['dnd']=intval($dnd);
        }
        return $rows;
    }

    /**
     * Public order-selection URL. Choosing SMS credit is intentionally public;
     * authentication is deferred until the customer continues to payment.
     */
    public static function public_purchase_target($amount=0){
        $url = self::auth_page_url('buy');
        if ($amount > 0) {
            $url = add_query_arg(array(
                'purchase_amount' => self::normalise_public_purchase_amount($amount),
                'review' => '1',
            ), $url);
        }
        return $url;
    }

    /** Normalise public purchase amounts before they enter a URL or quote. */
    public static function normalise_public_purchase_amount($amount){
        $amount = round((float)$amount, 2);
        if ($amount < 0) $amount = 0;
        // A defensive ceiling prevents absurd query-string values; gateway and
        // funding rules remain authoritative when payment is actually created.
        return min($amount, 1000000000);
    }

    /**
     * Authoritative public quote data for the theme/Elementor order review.
     * This does not create, charge or credit a wallet transaction.
     */
    public static function public_purchase_quote($amount=0){
        $amount = self::normalise_public_purchase_amount($amount);
        $currency = sanitize_text_field((string)get_option('bsms_currency','NGN')) ?: 'NGN';
        $rates = self::public_rate_summary();
        $normal = max(0, intval($rates['normal'] ?? 0));
        $amount_kobo = intval(round($amount * 100));
        $units = 0;
        if ($amount_kobo > 0 && $normal > 0) {
            $units = class_exists('BSMS_Pricing')
                ? max(0, intval(BSMS_Pricing::estimated_units_for_amount($amount_kobo, 'normal', '234')))
                : max(0, (int)floor($amount_kobo / $normal));
        }
        return array(
            'amount' => $amount,
            'amount_minor' => $amount_kobo,
            'currency' => $currency,
            'estimated_normal_segments' => $units,
            'normal_rate_minor' => $normal,
            'rates_kobo' => $rates,
        );
    }

    /**
     * Payment boundary for a selected public order. Guests are sent through
     * login and returned to the exact funding amount; authenticated customers
     * continue directly to the secure portal funding flow.
     */
    public static function public_payment_target($amount=0){
        $amount = self::normalise_public_purchase_amount($amount);
        $portal = home_url('/'.self::portal_slug().'/fund-wallet/');
        if ($amount > 0) $portal = add_query_arg('purchase_amount', (string)$amount, $portal);
        if (is_user_logged_in()) return $portal;
        return add_query_arg('redirect_to', $portal, self::auth_page_url('login'));
    }

    public static function render_public_pricing(){
        // Historical shortcode placeholders remain in existing WP pages. In the
        // canonical theme they must not inject a second marketing interface.
        if (self::theme_owns_public_pages() && !is_admin()) return '';
        if (!headers_sent()) {
            nocache_headers();
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
        }

        wp_enqueue_style('bsms-portal');
        $rates = self::public_rate_summary();
        $normal = intval($rates['normal'] ?? 0);
        $has_international = self::international_public_available();
        $international = isset($rates['international']) ? intval($rates['international']) : 0;
        $has_dnd = isset($rates['dnd']) && intval($rates['dnd']) > 0;
        $dnd = $has_dnd ? intval($rates['dnd']) : 0;
        global $wpdb;
        $pt = BSMS_DB::table('pricing');
        ob_start(); ?>
        <section class="bsms-public-hero bsms-public-hero-dark" style="color:#fff!important;background:linear-gradient(145deg,#0d6f4d,#11875d)!important;">
          <div><span class="bsms-public-kicker" style="color:#c5f0a9!important;"><?php esc_html_e('Simple SMS pricing', 'bulk-sms-portal'); ?></span><h1 style="color:#fff!important;"><?php esc_html_e('Know the rate before you send.', 'bulk-sms-portal'); ?></h1><p style="color:#e6f4ed!important;"><?php esc_html_e('Compare the services currently available on this platform, estimate your spend and continue to Buy SMS when you are ready.', 'bulk-sms-portal'); ?></p><div class="bsms-public-hero-actions"><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(self::auth_page_url('buy')); ?>"><?php esc_html_e('Buy SMS', 'bulk-sms-portal'); ?></a><a class="bsms-btn bsms-btn-outline" href="<?php echo esc_url(is_user_logged_in()?self::portal_url():self::auth_page_url('register')); ?>"><?php echo is_user_logged_in()?esc_html__('Open portal', 'bulk-sms-portal'):esc_html__('Create account', 'bulk-sms-portal'); ?></a></div></div>
          <div class="bsms-public-infograph"><div class="bsms-infograph-ring"><strong>₦</strong><span><?php esc_html_e('clear rates', 'bulk-sms-portal'); ?></span></div><ol><li><b>1</b><span><?php esc_html_e('Check rate', 'bulk-sms-portal'); ?></span></li><li><b>2</b><span><?php esc_html_e('Choose credit', 'bulk-sms-portal'); ?></span></li><li><b>3</b><span><?php esc_html_e('Send & track', 'bulk-sms-portal'); ?></span></li></ol></div>
        </section>
        <?php $plist = self::public_price_list(); $ng = $plist ? $plist[0] : null; $others = array_slice($plist, 1); ?>
        <section class="bsms-public-section"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Price per SMS page', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Nigerian numbers', 'bulk-sms-portal'); ?></h2></div><p><?php esc_html_e('One price for every SMS page, whatever the size of your send. A network with its own price is charged that price. You pay only for the numbers you send to.', 'bulk-sms-portal'); ?></p></div><div class="bsms-rate-grid">
          <?php if($ng && $ng['standard_kobo']): ?><article><span class="bsms-rate-icon">₦</span><small><?php esc_html_e('Every Nigerian network', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(BSMS_Util::money(intval($ng['standard_kobo']))); ?></strong><em><?php esc_html_e('per SMS page', 'bulk-sms-portal'); ?></em><p><?php esc_html_e('Unless the network has its own price below.', 'bulk-sms-portal'); ?></p></article><?php endif; ?>
          <?php if($ng): foreach($ng['networks'] as $nw): if(!$nw['standard_kobo']) continue; ?><article><span class="bsms-rate-icon">✉</span><small><?php echo esc_html($nw['name']); ?></small><strong><?php echo esc_html(BSMS_Util::money(intval($nw['standard_kobo']))); ?></strong><em><?php esc_html_e('per SMS page', 'bulk-sms-portal'); ?></em><p>Numbers on <?php echo esc_html($nw['name']); ?>.</p></article><?php endforeach; endif; ?>
          <?php if($ng && $ng['dnd_kobo']): ?><article><span class="bsms-rate-icon">✓</span><small><?php esc_html_e('Do Not Disturb numbers', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(BSMS_Util::money(intval($ng['dnd_kobo']))); ?></strong><em><?php esc_html_e('per SMS page', 'bulk-sms-portal'); ?></em><p><?php esc_html_e('When you choose to reach numbers on Do Not Disturb.', 'bulk-sms-portal'); ?></p></article><?php endif; ?>
          <?php if(!$ng || !$ng['standard_kobo']): ?><article><small><?php esc_html_e('Prices', 'bulk-sms-portal'); ?></small><strong><?php esc_html_e('Available in portal', 'bulk-sms-portal'); ?></strong><p><?php esc_html_e('Sign in to see the current prices.', 'bulk-sms-portal'); ?></p></article><?php endif; ?>
        </div></section>
        <?php if($others && $has_international): ?>
        <section class="bsms-public-section"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Outside Nigeria', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Other countries', 'bulk-sms-portal'); ?></h2></div><p><?php esc_html_e('Countries not listed here cannot be sent to yet.', 'bulk-sms-portal'); ?></p></div><div class="bsms-rate-grid">
          <?php foreach($others as $oc): if(!$oc['standard_kobo']) continue; ?><article><span class="bsms-rate-icon">◎</span><small><?php echo esc_html($oc['name'].' (+'.$oc['code'].')'); ?></small><strong><?php echo esc_html(BSMS_Util::money(intval($oc['standard_kobo']))); ?></strong><em><?php esc_html_e('per SMS page', 'bulk-sms-portal'); ?></em><p>Charged for each number in <?php echo esc_html($oc['name']); ?>.</p></article><?php endforeach; ?>
        </div></section>
        <?php endif; ?>
        <section class="bsms-public-cta" style="color:#fff!important;background:#123f2d!important;"><div><span class="bsms-public-kicker" style="color:#c5f0a9!important;"><?php esc_html_e('Ready to continue?', 'bulk-sms-portal'); ?></span><h2 style="color:#fff!important;"><?php esc_html_e('Choose your wallet credit and start sending.', 'bulk-sms-portal'); ?></h2></div><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(self::auth_page_url('buy')); ?>"><?php esc_html_e('View Buy SMS options', 'bulk-sms-portal'); ?></a></section>
        <?php return self::public_shell('pricing', ob_get_clean());
    }

    public static function render_public_buy_sms(){
        // Historical shortcode placeholders remain in existing WP pages. In the
        // canonical theme they must not inject a second marketing interface.
        if (self::theme_owns_public_pages() && !is_admin()) return '';
        if (!headers_sent()) {
            nocache_headers();
            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
        }

        wp_enqueue_style('bsms-portal');
        $rates = self::public_rate_summary();
        $base = max(0, intval($rates['normal'] ?? 0));
        $has_international = self::international_public_available();
        $international = isset($rates['international']) ? intval($rates['international']) : 0;
        $currency = sanitize_text_field((string)get_option('bsms_currency','NGN')) ?: 'NGN';
        $quick = array_filter(array_map('floatval', preg_split('/[,\s]+/', (string)get_option('bsms_funding_quick_amounts','1000,2500,5000,10000,25000'))));
        if (!$quick) $quick = array(1000,2500,5000,10000,25000);
        $quick = array_slice(array_values(array_unique(array_filter($quick, fn($v)=>$v>0))),0,5);
        $target = function($amount){ return self::public_purchase_target($amount); };
        $selected_amount = self::normalise_public_purchase_amount(wp_unslash($_GET['purchase_amount'] ?? 0)); // phpcs:ignore WordPress.Security.NonceVerification.Recommended, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Read-only amount to preselect; normalise_public_purchase_amount() turns it into a whole number.
        $selected_quote = $selected_amount > 0 ? self::public_purchase_quote($selected_amount) : array();
        ob_start(); ?>
        <section class="bsms-public-hero bsms-buy-hero bsms-public-hero-dark" style="color:#fff!important;background:linear-gradient(145deg,#0d6f4d,#11875d)!important;">
            <div><span class="bsms-public-kicker" style="color:#c5f0a9!important;"><?php esc_html_e('Flexible SMS funding', 'bulk-sms-portal'); ?></span><h1 style="color:#fff!important;"><?php esc_html_e('Buy SMS without the guesswork.', 'bulk-sms-portal'); ?></h1><p style="color:#e6f4ed!important;"><?php esc_html_e('See your customer-facing rates before you sign in. Choose an amount, then login or create an account to complete checkout securely.', 'bulk-sms-portal'); ?></p><div class="bsms-public-hero-actions"><a class="bsms-btn bsms-btn-primary" href="#bsms-public-packages"><?php esc_html_e('View options', 'bulk-sms-portal'); ?></a><a class="bsms-btn bsms-btn-outline" href="<?php echo esc_url(self::auth_page_url('help')); ?>"><?php esc_html_e('How it works', 'bulk-sms-portal'); ?></a></div></div>
            <div class="bsms-public-infograph"><div class="bsms-infograph-ring"><strong>3</strong><span><?php esc_html_e('easy steps', 'bulk-sms-portal'); ?></span></div><ol><li><b>1</b><span><?php esc_html_e('Choose credit', 'bulk-sms-portal'); ?></span></li><li><b>2</b><span><?php esc_html_e('Login / register', 'bulk-sms-portal'); ?></span></li><li><b>3</b><span><?php esc_html_e('Pay & send', 'bulk-sms-portal'); ?></span></li></ol></div>
        </section>
        <section class="bsms-public-section"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Current rates', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Transparent service pricing', 'bulk-sms-portal'); ?></h2></div><p><?php esc_html_e('Actual cost is calculated per SMS segment, destination and selected delivery service.', 'bulk-sms-portal'); ?></p></div>
            <div class="bsms-rate-grid">
                <article><span class="bsms-rate-icon">✉</span><small><?php esc_html_e('Normal SMS', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html(BSMS_Util::money(intval($rates['normal']))); ?></strong><em><?php esc_html_e('from / segment', 'bulk-sms-portal'); ?></em><p><?php esc_html_e('Everyday local messaging.', 'bulk-sms-portal'); ?></p></article>
                <article><span class="bsms-rate-icon">✓</span><small><?php esc_html_e('DND Delivery', 'bulk-sms-portal'); ?></small><?php if(isset($rates['dnd']) && intval($rates['dnd'])>0): ?><strong><?php echo esc_html(BSMS_Util::money(intval($rates['dnd']))); ?></strong><em><?php esc_html_e('from / segment', 'bulk-sms-portal'); ?></em><p><?php esc_html_e('Enhanced delivery for DND numbers where supported.', 'bulk-sms-portal'); ?></p><?php else: ?><strong class="bsms-rate-configured"><?php esc_html_e('Rate varies', 'bulk-sms-portal'); ?></strong><em><?php esc_html_e('shown before sending', 'bulk-sms-portal'); ?></em><p><?php esc_html_e('The applicable DND rate is confirmed before your message is sent.', 'bulk-sms-portal'); ?></p><?php endif; ?></article>
                <?php if($has_international): ?><article><span class="bsms-rate-icon">◎</span><small><?php esc_html_e('International SMS', 'bulk-sms-portal'); ?></small><?php if($international>0): ?><strong><?php echo esc_html(BSMS_Util::money($international)); ?></strong><em><?php esc_html_e('from / segment', 'bulk-sms-portal'); ?></em><?php else: ?><strong><?php esc_html_e('Destination-based pricing', 'bulk-sms-portal'); ?></strong><em><?php esc_html_e('shown before sending', 'bulk-sms-portal'); ?></em><?php endif; ?><p><?php esc_html_e('Rates vary by destination and are confirmed before sending.', 'bulk-sms-portal'); ?></p></article><?php endif; ?>
            </div>
        </section>
        <?php if($selected_amount > 0): ?>
        <section class="bsms-public-section bsms-public-order-review" id="bsms-order-review"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Review your order', 'bulk-sms-portal'); ?></span><h2><?php echo esc_html($selected_quote['currency'].' '.number_format($selected_amount,2)); ?> <?php esc_html_e('SMS credit', 'bulk-sms-portal'); ?></h2></div><p><?php esc_html_e('You can choose and review SMS credit without an account. Sign in or create an account only when you continue to payment.', 'bulk-sms-portal'); ?></p></div><div class="bsms-package-card featured"><small><?php esc_html_e('Selected wallet credit', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html($selected_quote['currency'].' '.number_format($selected_amount,2)); ?></strong><p><?php esc_html_e('Approx.', 'bulk-sms-portal'); ?> <b><?php echo esc_html(number_format(intval($selected_quote['estimated_normal_segments']))); ?></b> <?php esc_html_e('normal SMS segments at the current starting rate. Your exact sending charge is confirmed before messages are sent.', 'bulk-sms-portal'); ?></p><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(self::public_payment_target($selected_amount)); ?>"><?php esc_html_e('Continue to payment →', 'bulk-sms-portal'); ?></a></div></section>
        <?php endif; ?>
        <section class="bsms-public-section" id="bsms-public-packages"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Choose your wallet credit', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Start with any amount that suits you', 'bulk-sms-portal'); ?></h2></div><p><?php esc_html_e('Your wallet remains flexible—you are not locked into a recurring plan.', 'bulk-sms-portal'); ?></p></div><div class="bsms-package-grid">
            <?php foreach($quick as $i=>$amt): $kobo=intval(round($amt*100)); $units=class_exists('BSMS_Pricing') ? max(1,BSMS_Pricing::estimated_units_for_amount($kobo,'normal','234')) : max(1,(int)floor($kobo/$base)); ?>
            <article class="bsms-package-card <?php echo $i===2?'featured':''; ?>"><?php if($i===2): ?><span class="bsms-package-badge"><?php esc_html_e('Popular', 'bulk-sms-portal'); ?></span><?php endif; ?><small><?php esc_html_e('Wallet credit', 'bulk-sms-portal'); ?></small><strong><?php echo esc_html($currency.' '.number_format($amt,0)); ?></strong><p><?php esc_html_e('Approx.', 'bulk-sms-portal'); ?> <b><?php echo esc_html(number_format($units)); ?></b> <?php esc_html_e('normal SMS segments at the current starting rate.', 'bulk-sms-portal'); ?></p><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url($target($amt)); ?>"><?php echo is_user_logged_in()?esc_html__('Continue to checkout', 'bulk-sms-portal'):esc_html__('Buy now', 'bulk-sms-portal'); ?> →</a></article>
            <?php endforeach; ?>
        </div><p class="bsms-public-fineprint"><?php esc_html_e('Estimates are illustrative. Final units/cost depend on message length, route, network and destination. Your exact charge is shown before sending.', 'bulk-sms-portal'); ?></p></section>
        <section class="bsms-public-cta"><div><span class="bsms-public-kicker"><?php esc_html_e('Already know what you need?', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Fund, compose and track from one portal.', 'bulk-sms-portal'); ?></h2></div><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(is_user_logged_in()?self::portal_url():self::auth_page_url('register')); ?>"><?php echo is_user_logged_in()?esc_html__('Open my portal', 'bulk-sms-portal'):esc_html__('Create free account', 'bulk-sms-portal'); ?></a></section>
        <?php return self::public_shell('buy', ob_get_clean());
    }

    public static function render_help_centre(){
        // Historical shortcode placeholders remain in existing WP pages. In the
        // canonical theme they must not inject a second marketing interface.
        if (self::theme_owns_public_pages() && !is_admin()) return '';
        wp_enqueue_style('bsms-portal');
        BSMS_Shortcodes::enqueue_widgets();
        $faqs = array(
            array(__('Getting started', 'bulk-sms-portal'),__('How do I start sending SMS?', 'bulk-sms-portal'),__('Create an account, add money to your wallet, choose an approved sender name, add phone numbers and check the cost before sending.', 'bulk-sms-portal')),
            array(__('Funding', 'bulk-sms-portal'),__('How do I buy SMS?', 'bulk-sms-portal'),__('Open Buy SMS, choose an amount and sign in or register. Logged-in customers can complete online checkout or use an available manual funding option.', 'bulk-sms-portal')),
            array(__('Sender IDs', 'bulk-sms-portal'),__('Why is my sender name reviewed?', 'bulk-sms-portal'),__('A sender name helps people recognise your messages. We review new names before they can be used.', 'bulk-sms-portal')),
            array(__('Delivery', 'bulk-sms-portal'),__('What do Successful and Failed mean?', 'bulk-sms-portal'),__('Successful means the message was accepted by the configured SMS service. Failed means it could not be completed; check Delivery Reports for the reason.', 'bulk-sms-portal')),
            array('DND',__('Can I send to numbers on Do Not Disturb?', 'bulk-sms-portal'),__('Where this option is available, choose Do Not Disturb delivery before sending. We show the charge before you confirm.', 'bulk-sms-portal')),
            array(__('International', 'bulk-sms-portal'),__('Can I message international numbers?', 'bulk-sms-portal'),__('Yes where international messaging is enabled. Use full international format with country code; the estimate shown before sending reflects the configured destination rate.', 'bulk-sms-portal')),
            array(__('Contacts', 'bulk-sms-portal'),__('Can I save groups of recipients?', 'bulk-sms-portal'),__('Yes. Contacts lets you create reusable phone groups, import numbers and quickly select them while composing a campaign.', 'bulk-sms-portal')),
            array(__('Scheduling', 'bulk-sms-portal'),__('Can messages be sent later?', 'bulk-sms-portal'),__('If this option is available, choose a date and time on Send SMS.', 'bulk-sms-portal')),
            array(__('Balance', 'bulk-sms-portal'),__('Why is my wallet balance lower than expected?', 'bulk-sms-portal'),__('SMS charges depend on recipients, message segments and delivery service. Transactions and the pre-send estimate show how your wallet is being used.', 'bulk-sms-portal')),
            array(__('Security', 'bulk-sms-portal'),__('I cannot log in—what should I do?', 'bulk-sms-portal'),__('Use Forgot Password to request a secure reset link. If the issue continues, use your organisation’s support contact shown on the site.', 'bulk-sms-portal')),
        );
        ob_start(); ?>
        <section class="bsms-public-hero bsms-help-hero"><div><span class="bsms-public-kicker"><?php esc_html_e('Help Centre', 'bulk-sms-portal'); ?></span><h1><?php esc_html_e('Answers that get you sending.', 'bulk-sms-portal'); ?></h1><p><?php esc_html_e('Search practical guidance for funding, Sender IDs, composing, delivery, contacts and account access.', 'bulk-sms-portal'); ?></p><div class="bsms-help-search"><span>⌕</span><input id="bsmsHelpSearch" type="search" placeholder="<?php esc_attr_e('Search help topics…', 'bulk-sms-portal'); ?>" autocomplete="off"></div></div><div class="bsms-help-visual"><strong>6</strong><span><?php esc_html_e('core workflows', 'bulk-sms-portal'); ?></span><div><i></i><i></i><i></i><i></i><i></i><i></i></div></div></section>
        <section class="bsms-help-journey"><article><b>1</b><strong><?php esc_html_e('Fund', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Add SMS credit', 'bulk-sms-portal'); ?></span></article><i>→</i><article><b>2</b><strong><?php esc_html_e('Prepare', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Sender ID & contacts', 'bulk-sms-portal'); ?></span></article><i>→</i><article><b>3</b><strong><?php esc_html_e('Compose', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Write your message', 'bulk-sms-portal'); ?></span></article><i>→</i><article><b>4</b><strong><?php esc_html_e('Review', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Check cost & recipients', 'bulk-sms-portal'); ?></span></article><i>→</i><article><b>5</b><strong><?php esc_html_e('Send', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Now or schedule', 'bulk-sms-portal'); ?></span></article><i>→</i><article><b>6</b><strong><?php esc_html_e('Track', 'bulk-sms-portal'); ?></strong><span><?php esc_html_e('Delivery reports', 'bulk-sms-portal'); ?></span></article></section>
        <section class="bsms-public-section"><div class="bsms-public-section-head"><div><span class="bsms-public-kicker"><?php esc_html_e('Frequently asked questions', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Popular help topics', 'bulk-sms-portal'); ?></h2></div><p id="bsmsHelpCount"><?php echo count($faqs); ?> topics</p></div><div class="bsms-faq-grid" id="bsmsFaqGrid">
        <?php foreach($faqs as $f): ?><details data-help="<?php echo esc_attr(strtolower(implode(' ',$f))); ?>"><summary><span><?php echo esc_html($f[0]); ?></span><strong><?php echo esc_html($f[1]); ?></strong><b>+</b></summary><p><?php echo esc_html($f[2]); ?></p></details><?php endforeach; ?>
        </div><div id="bsmsHelpEmpty" class="bsms-public-empty" hidden><?php esc_html_e('No help topic matched that search. Try a broader word such as “funding”, “delivery” or “Sender ID”.', 'bulk-sms-portal'); ?></div></section>
        <section class="bsms-public-cta"><div><span class="bsms-public-kicker"><?php esc_html_e('Ready to continue?', 'bulk-sms-portal'); ?></span><h2><?php esc_html_e('Go from help to action.', 'bulk-sms-portal'); ?></h2></div><div class="bsms-public-hero-actions"><a class="bsms-btn bsms-btn-outline" href="<?php echo esc_url(self::auth_page_url('buy')); ?>"><?php esc_html_e('View SMS rates', 'bulk-sms-portal'); ?></a><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(is_user_logged_in()?self::portal_url():self::auth_page_url('login')); ?>"><?php echo is_user_logged_in()?esc_html__('Open portal', 'bulk-sms-portal'):esc_html__('Login', 'bulk-sms-portal'); ?></a></div></section>
        <?php return self::public_shell('help', ob_get_clean());
    }

    public static function render_public_api_docs($atts=array()){
        BSMS_Shortcodes::enqueue_widgets(true);
        $base=rtrim(home_url('/api/'),'/');
        // Public documentation stays generic and cache-safe. Personalised examples
        // belong in /portal/api, never in a public Elementor page.
        $send="curl -H 'Authorization: Bearer YOUR_API_KEY' -X POST '".$base."/send' --data-urlencode 'sender=YOUR_SENDER_ID' --data-urlencode 'recipients=234XXXXXXXXXX' --data-urlencode 'message=YOUR_MESSAGE'";
        $balance="curl -H 'Authorization: Bearer YOUR_API_KEY' '".$base."/balance'";
        $status="curl -H 'Authorization: Bearer YOUR_API_KEY' '".$base."/status?messageid=MSG123'";
        $codes=array(
            'NS1000'=>array(__('Request accepted for processing', 'bulk-sms-portal'),__('Save the message ID and check its status.', 'bulk-sms-portal')),
            'NS1001'=>array(__('Message processed successfully', 'bulk-sms-portal'),__('No further action is required.', 'bulk-sms-portal')),
            'NS1002'=>array(__('Still processing', 'bulk-sms-portal'),__('Check the message status again shortly.', 'bulk-sms-portal')),
            'NS1100'=>array(__('Balance request successful', 'bulk-sms-portal'),__('Use the returned balance in your application.', 'bulk-sms-portal')),
            'NS2001'=>array(__('Authentication failed', 'bulk-sms-portal'),__('Check the account or API credentials.', 'bulk-sms-portal')),
            'NS2002'=>array(__('Invalid or unavailable Sender ID', 'bulk-sms-portal'),__('Use an approved Sender ID.', 'bulk-sms-portal')),
            'NS2003'=>array(__('Invalid recipient', 'bulk-sms-portal'),__('Check the recipient number and international format.', 'bulk-sms-portal')),
            'NS2004'=>array(__('Invalid or missing message', 'bulk-sms-portal'),__('Supply a message before sending.', 'bulk-sms-portal')),
            'NS2005'=>array(__('Insufficient balance', 'bulk-sms-portal'),__('Fund the account and try again.', 'bulk-sms-portal')),
            'NS2008'=>array(__('Request limit exceeded', 'bulk-sms-portal'),__('Wait before sending more requests.', 'bulk-sms-portal')),
            'NS2009'=>array(__('Message ID not found', 'bulk-sms-portal'),__('Check the message ID returned by Send SMS.', 'bulk-sms-portal')),
            'NS2010'=>array(__('Account or API access unavailable', 'bulk-sms-portal'),__('Check account access or contact support.', 'bulk-sms-portal')),
            'NS3001'=>array(__('Message processing failed', 'bulk-sms-portal'),__('Check message status/details before retrying.', 'bulk-sms-portal')),
            'NS9000'=>array(__('Service error', 'bulk-sms-portal'),__('Try again later or contact support if it continues.', 'bulk-sms-portal')),
        );
        ob_start(); ?>
        <div class="bsms-api-component" aria-label="<?php echo esc_attr(BSMS_Util::brand_name()); ?> API quick integration">
          <div class="bsms-api-component-intro"><h2><?php esc_html_e('Quick API integration', 'bulk-sms-portal'); ?></h2><p><?php esc_html_e('Sign in, open the', 'bulk-sms-portal'); ?> <a href="<?php echo esc_url(BSMS_Util::portal_url(array(), 'api')); ?>"><?php esc_html_e('API page', 'bulk-sms-portal'); ?></a> <?php esc_html_e('in your portal and create an API key. Send it in the Authorization header over https. Replace the placeholders with your own details.', 'bulk-sms-portal'); ?></p></div>
          <div class="bsms-api-component-examples">
            <?php foreach(array('Send SMS'=>$send,'Check balance'=>$balance,'Check message status'=>$status) as $label=>$url): $id='bsms-api-'.sanitize_key($label); ?>
            <article class="bsms-api-component-card"><h3><?php echo esc_html($label); ?></h3><div class="bsms-api-code-row"><code id="<?php echo esc_attr($id); ?>"><?php echo esc_html($url); ?></code><button class="bsms-api-copy" type="button" data-copy="#<?php echo esc_attr($id); ?>"><?php esc_html_e('Copy example', 'bulk-sms-portal'); ?></button></div></article><?php endforeach; ?>
          </div>
          <p class="bsms-api-component-note"><strong><?php esc_html_e('Keep API keys private.', 'bulk-sms-portal'); ?></strong> <?php esc_html_e('Use HTTPS and never publish an API key in frontend website code. Older connections that sign in with your portal username and password (Basic authorization) keep working over https, but new connections should use an API key, which you can switch off at any time without changing your password. Your', 'bulk-sms-portal'); ?> <a href="<?php echo esc_url(BSMS_Util::portal_url(array(), 'api')); ?>"><?php esc_html_e('portal API page', 'bulk-sms-portal'); ?></a> <?php esc_html_e('has examples with your own web addresses.', 'bulk-sms-portal'); ?></p>
          <div class="bsms-api-component-head"><h2><?php esc_html_e('Response codes', 'bulk-sms-portal'); ?></h2><p><?php esc_html_e('These codes stay the same even when the underlying SMS service changes.', 'bulk-sms-portal'); ?></p></div>
          <div class="bsms-api-component-codes"><?php foreach($codes as $code=>$row): ?><div><code><?php echo esc_html($code); ?></code><span><strong><?php echo esc_html($row[0]); ?></strong><small><?php echo esc_html($row[1]); ?></small></span></div><?php endforeach; ?></div>
          <div class="bsms-api-component-how"><h2><?php esc_html_e('How sending works', 'bulk-sms-portal'); ?></h2><p>A successful Send API response means <?php echo esc_html(BSMS_Util::brand_name()); ?> <?php esc_html_e('accepted the request for processing. Save the returned', 'bulk-sms-portal'); ?> <code>messageid</code> <?php esc_html_e('and use Check message status for the final processing result.', 'bulk-sms-portal'); ?></p></div>
        </div>
        <?php return ob_get_clean();
    }

    public static function render_payment_status(){
        wp_enqueue_style('bsms-portal');
        $status = sanitize_key(wp_unslash($_GET['payment_status'] ?? $_GET['status'] ?? 'pending')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only payment result shown after returning from checkout.
        if ($status === 'successful' || $status === 'paid' || $status === 'completed') $status='success';
        if ($status === 'cancelled' || $status === 'canceled') $status='failed';
        $ref = sanitize_text_field(wp_unslash($_GET['reference'] ?? $_GET['trxref'] ?? '')); // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only payment reference shown after returning from checkout.
        $map = array(
            'success'=>array('✓',__('Payment returned', 'bulk-sms-portal'),__('Open your portal to confirm that the payment has been checked and the money is in your wallet.', 'bulk-sms-portal')),
            'failed'=>array('!',__('Payment not completed', 'bulk-sms-portal'),__('Your wallet has not been confirmed as credited. Open your portal to check the payment before trying again.', 'bulk-sms-portal')),
            'pending'=>array('…',__('Payment being checked', 'bulk-sms-portal'),__('Open your portal to check whether the money has been added before attempting another payment.', 'bulk-sms-portal')),
        );
        if (!isset($map[$status])) $status='pending';
        $d=$map[$status];
        ob_start(); ?><section class="bsms-payment-state bsms-payment-<?php echo esc_attr($status); ?>"><div class="bsms-payment-icon"><?php echo esc_html($d[0]); ?></div><span class="bsms-public-kicker"><?php esc_html_e('Payment status', 'bulk-sms-portal'); ?></span><h2><?php echo esc_html($d[1]); ?></h2><p><?php echo esc_html($d[2]); ?></p><?php if($ref): ?><div class="bsms-payment-ref"><span><?php esc_html_e('Reference', 'bulk-sms-portal'); ?></span><code><?php echo esc_html($ref); ?></code></div><?php endif; ?><div class="bsms-auth-actions"><a class="bsms-btn bsms-btn-primary" href="<?php echo esc_url(is_user_logged_in()?self::portal_url():self::auth_page_url('login')); ?>"><?php echo is_user_logged_in()?esc_html__('Open Portal', 'bulk-sms-portal'):esc_html__('Login to check wallet', 'bulk-sms-portal'); ?></a><a class="bsms-btn bsms-btn-outline" href="<?php echo esc_url(self::auth_page_url('buy')); ?>"><?php esc_html_e('Back to Buy SMS', 'bulk-sms-portal'); ?></a></div></section><?php
        return self::public_shell('', ob_get_clean(), false);
    }

    public static function ajax_refresh_nonce(){
        if (!is_user_logged_in()) {
            wp_send_json_error(array('error'=>__('You are not logged in. Please refresh and log in again.', 'bulk-sms-portal')), 401);
        }
        nocache_headers();
        wp_send_json_success(array(
            'nonce' => wp_create_nonce('wp_rest'),
            'root'  => esc_url_raw(rest_url('bsms/v1')),
            'time'  => time(),
        ));
    }

    public static function popup_notices(){
        // Notices are consumed and rendered as portal announcement cards inside render().
        // Keep this hook as a no-op fallback so old alert() popups do not interrupt the UI.
        return;
    }
}
