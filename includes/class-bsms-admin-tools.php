<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

/**
 * v3.6.1 — the admin tools that used to live only in WordPress admin
 * (Setup Guide and Activity Log), served as REST data for the shared pages.
 * Pro adds more tools through filters.
 */
class BSMS_Admin_Tools {

    public static function init(){
        add_action('rest_api_init', array(__CLASS__, 'routes'));
        // v3.7.0: logs are kept for a set time (Platform Settings > Advanced).
        add_action('bsms_prune_logs', array(__CLASS__, 'prune_logs'));
        add_action('init', function(){ if (!wp_next_scheduled('bsms_prune_logs')) wp_schedule_event(time() + 600, 'daily', 'bsms_prune_logs'); });
    }

    /**
     * Delete log entries older than the chosen number of days (0 keeps them).
     * Money records (wallet history, messages, sends, payments) are never pruned.
     */
    public static function prune_logs(){
        global $wpdb;
        $days = intval(get_option('bsms_log_retention_days', 180));
        if ($days <= 0) return 0;
        $cut = gmdate('Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS);
        $done = 0;
        foreach (array('activity_logs','api_logs','dlr_events','notifications','api_usage') as $name) {
            $t = BSMS_DB::table($name);
            if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) !== $t) continue;
            for ($i = 0; $i < 20; $i++) { // at most 100,000 rows a table a day
                $ids = array_map('intval', (array) $wpdb->get_col($wpdb->prepare('SELECT id FROM %i WHERE created_at < %s ORDER BY id ASC LIMIT 5000', $t, $cut)));
                if (!$ids) break;
                $done += intval($wpdb->query($wpdb->prepare('DELETE FROM %i WHERE id IN (' . implode(',', array_fill(0, count($ids), '%d')) . ')', array_merge(array($t), $ids))));
                if (count($ids) < 5000) break;
            }
        }
        return $done;
    }

    private static function admin(){ return class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can_manage_platform() : current_user_can('manage_options'); }

    public static function routes(){
        $admin = function(){ return BSMS_Admin_Tools::admin(); };
        $r = function($path, $method, $cb, $perm) { register_rest_route('bsms/v1', $path, array('methods'=>$method, 'callback'=>array(__CLASS__, $cb), 'permission_callback'=>$perm)); };
        $r('/admin/setup', 'GET', 'setup', $admin);
        $r('/admin/activity-log', 'GET', 'activity', $admin);
        $r('/admin/notification-log', 'GET', 'notification_log', $admin);
    }

    /* ---------------- Setup Guide ---------------- */
    public static function setup(){
        global $wpdb;
        $apis = BSMS_DB::table('apis'); $pricing = BSMS_DB::table('pricing');
        $active_apis = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_apis WHERE is_active=1"));
        $default_api = intval(get_option('bsms_default_api_id', 0));
        $std_price = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_pricing WHERE active=1 AND country_code='234' AND route IN ('normal','standard')"));
        $sender = trim((string)get_option('bsms_default_sender', ''));
        $paystack = get_option('bsms_paystack_public_key') && get_option('bsms_paystack_secret_key');
        $banks = json_decode((string)get_option('bsms_bank_accounts_json', ''), true);
        $has_bank = is_array($banks) && array_filter($banks, function($b){ return !empty($b['account_number']) && (!isset($b['active']) || !empty($b['active'])); });
        $portal_page = 0;
        foreach (get_pages(array('number'=>200)) as $p) { if (has_shortcode((string)$p->post_content, 'bsms_portal')) { $portal_page = $p->ID; break; } }
        $logo = class_exists('BSMS_Util') ? BSMS_Util::logo_url() : '';
        $steps = array(
            array('key'=>'brand', 'title'=>__('Your brand name and logo', 'bulk-sms-portal'), 'done'=>(bool)get_option('bsms_brand_name') && (bool)$logo, 'text'=>__('Shown in the portal, emails and the public pages.', 'bulk-sms-portal'), 'page'=>'admin-settings', 'tab'=>'branding'),
            array('key'=>'service', 'title'=>__('Connect an SMS service', 'bulk-sms-portal'), 'done'=>$active_apis > 0 && $default_api > 0, 'text'=>__('The service that delivers your customers\' messages, chosen for standard messages.', 'bulk-sms-portal'), 'page'=>'admin-apis', 'tab'=>''),
            array('key'=>'price', 'title'=>__('Set the price of one SMS page', 'bulk-sms-portal'), 'done'=>$std_price > 0, 'text'=>__('Customers see the cost before they send.', 'bulk-sms-portal'), 'page'=>'admin-pricing', 'tab'=>''),
            array('key'=>'pay', 'title'=>__('Choose how customers pay', 'bulk-sms-portal'), 'done'=>$paystack || $has_bank, 'text'=>__('Online payments, a bank account for transfers, or both.', 'bulk-sms-portal'), 'page'=>'admin-settings', 'tab'=>$paystack ? 'funding' : 'payments'),
            array('key'=>'sender', 'title'=>__('Set your shared sender name', 'bulk-sms-portal'), 'done'=>$sender !== '' && strtoupper($sender) !== 'SMS', 'text'=>__('Used by customers who have no approved name of their own. Your brand name works well.', 'bulk-sms-portal'), 'page'=>'admin-senders', 'tab'=>''),
            array('key'=>'support', 'title'=>__('Add your support email', 'bulk-sms-portal'), 'done'=>(bool)get_option('bsms_support_email'), 'text'=>__('Shown in the Help Centre and used to reply to customers.', 'bulk-sms-portal'), 'page'=>'admin-settings', 'tab'=>'branding'),
            array('key'=>'portal', 'title'=>__('Publish the customer portal page', 'bulk-sms-portal'), 'done'=>$portal_page > 0, 'text'=>$portal_page ? sprintf(/* translators: %s: a value filled in when shown */ __('Customers sign in at %s.', 'bulk-sms-portal'), esc_url_raw(get_permalink($portal_page))) : __('Add the [bsms_portal] shortcode to a page so customers can sign in.', 'bulk-sms-portal'), 'page'=>'', 'tab'=>'', 'url'=>$portal_page ? get_permalink($portal_page) : admin_url('post-new.php?post_type=page')),
        );
        $done = count(array_filter($steps, function($s){ return $s['done']; }));
        return array('ok'=>true, 'steps'=>$steps, 'done'=>$done, 'total'=>count($steps));
    }

    /* ---------------- Activity Log ---------------- */
    private static function paging(WP_REST_Request $r, $default = 30){
        $page = max(1, intval($r->get_param('page'))); $per = intval($r->get_param('per_page')) ?: $default; $per = min(100, max(5, $per));
        return array($page, $per, ($page - 1) * $per);
    }
    private static function user_label($id){
        $id = intval($id); if (!$id) return '';
        $u = get_user_by('id', $id); return $u ? ($u->display_name ?: $u->user_login) : (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), $id));
    }
    /** Plain wording for the log, so admins never read internal names. */
    public static function plain_action($action, $message){
        $map = array(
            'api_saved'=>__('SMS service settings saved', 'bulk-sms-portal'), 'auth_honeypot_blocked'=>__('A sign-up or sign-in by a robot was blocked', 'bulk-sms-portal'),
            'auth_recaptcha_failed'=>__('A sign-in failed the “I am not a robot” check', 'bulk-sms-portal'), 'auth_security_saved'=>__('Sign-in safety settings saved', 'bulk-sms-portal'),
            'auth_too_fast_blocked'=>__('A form sent too fast to be a person was blocked', 'bulk-sms-portal'), 'branding_saved'=>__('Brand settings saved', 'bulk-sms-portal'),
            'comment_recaptcha_failed'=>__('A comment failed the “I am not a robot” check', 'bulk-sms-portal'), 'custom_menus_saved'=>__('Extra portal pages saved', 'bulk-sms-portal'),
            'customer_pricing_changed'=>__('A customer’s price was changed', 'bulk-sms-portal'), 'dashboard_styling_saved'=>__('Portal look saved', 'bulk-sms-portal'), 'design_tokens_saved'=>__('Portal look saved', 'bulk-sms-portal'),
            'dlr_poll_ran'=>__('Message results checked automatically', 'bulk-sms-portal'), 'funding_accounts_saved'=>__('Bank account details for transfers saved', 'bulk-sms-portal'),
            'legacy_wallet_balance_retired'=>__('Old wallet records tidied up', 'bulk-sms-portal'), 'manual_funding_approved'=>__('Bank transfer approved', 'bulk-sms-portal'), 'manual_funding_rejected'=>__('Bank transfer declined', 'bulk-sms-portal'),
            'payment_gateways_saved'=>__('Online payment settings saved', 'bulk-sms-portal'), 'payment_test_refused'=>__('A test payment was not added to a wallet', 'bulk-sms-portal'),
            'platform_settings_saved'=>__('Platform settings saved', 'bulk-sms-portal'), 'public_api_auth_failed'=>__('A connected website or app used wrong sign-in details', 'bulk-sms-portal'),
            'public_api_rate_limited'=>__('A connected website or app sent too many requests', 'bulk-sms-portal'), 'public_api_send'=>__('Message sent from a connected website or app', 'bulk-sms-portal'),
            'report_job_status'=>__('Message result changed by an admin', 'bulk-sms-portal'), 'report_job_sync'=>__('Message results checked by an admin', 'bulk-sms-portal'), 'report_sync_pending'=>__('Waiting message results checked by an admin', 'bulk-sms-portal'),
            'reseller_saved'=>__('Reseller details saved', 'bulk-sms-portal'), 'routes_saved'=>__('SMS service choices saved', 'bulk-sms-portal'), 'setup_saved'=>__('Setup saved', 'bulk-sms-portal'),
            'stranded_campaigns_recovered'=>__('Unsent messages were put back to send', 'bulk-sms-portal'), 'subscriptions_processed'=>__('Scheduled top-ups added', 'bulk-sms-portal'),
            'system_settings_saved'=>__('System settings saved', 'bulk-sms-portal'), 'user_entitlements_saved'=>__('A customer’s features were changed', 'bulk-sms-portal'),
            'user_profile_updated'=>__('A customer’s profile was corrected', 'bulk-sms-portal'), 'user_status_updated'=>__('A customer’s account was switched on or off', 'bulk-sms-portal'),
            'wallet_adjusted'=>__('A customer’s wallet was changed by an admin', 'bulk-sms-portal'), 'white_label_controls_saved'=>__('Feature settings saved', 'bulk-sms-portal'),
            'woocommerce_wallet_credit_failed'=>__('A store payment was not added: no rate for its currency', 'bulk-sms-portal'), 'topup_saved'=>__('Scheduled top-up saved', 'bulk-sms-portal'), 'topups_paused_on_upgrade'=>__('Scheduled top-ups with a past date were paused for checking', 'bulk-sms-portal'), 'price_list_saved'=>__('Prices saved', 'bulk-sms-portal'),
        );
        if (isset($map[$action])) {
            // Keep useful detail after a colon (an amount, a name), but not internal names.
            if ($action === 'topup_saved' && strpos((string)$message, ':') !== false) return $map[$action] . ':' . substr((string)$message, strpos((string)$message, ':') + 1);
            return $map[$action];
        }
        $m = trim((string)$message);
        return $m !== '' ? $m : ucfirst(str_replace('_', ' ', (string)$action));
    }

    public static function activity(WP_REST_Request $r){
        global $wpdb;
        $t = BSMS_DB::table('activity_logs');
        list($page, $per, $offset) = self::paging($r);
        $where = array('1=1'); $args = array();
        $q = trim(sanitize_text_field((string)$r->get_param('search')));
        // Routine automatic checks run every few minutes and would bury real changes.
        if ($q === '') { $where[] = "a.action NOT IN ('dlr_poll_ran','subscriptions_processed')"; }
        if ($q !== '') { $like = '%' . $wpdb->esc_like($q) . '%'; $where[] = '(a.message LIKE %s OR a.action LIKE %s OR a.ip_address LIKE %s OR u.display_name LIKE %s OR u.user_email LIKE %s)'; array_push($args, $like, $like, $like, $like, $like); }
        $w = implode(' AND ', $where);
        $from = "FROM {$wpdb->prefix}bsms_activity_logs a LEFT JOIN {$wpdb->users} u ON u.ID = a.actor_id WHERE $w";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- FROM/WHERE is built from fixed fragments in this function; values use placeholders.
        $total = intval($args ? $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) $from", $args)) : $wpdb->get_var("SELECT COUNT(*) $from"));
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- FROM/WHERE is built from fixed fragments in this function; values use placeholders.
        $rows = $wpdb->get_results($wpdb->prepare("SELECT a.* $from ORDER BY a.id DESC LIMIT %d OFFSET %d", array_merge($args, array($per, $offset))), ARRAY_A);
        $items = array_map(function($x){ return array(
            'id'=>intval($x['id']), 'date'=>$x['created_at'], 'action'=>$x['action'], 'message'=>self::plain_action($x['action'], $x['message']),
            'by'=>self::user_label($x['actor_id']) ?: __('Automatic', 'bulk-sms-portal'), 'about'=>self::user_label($x['user_id']), 'ip'=>(string)$x['ip_address'],
        ); }, (array)$rows);
        return array('ok'=>true, 'items'=>$items, 'page'=>$page, 'per_page'=>$per, 'total'=>$total, 'total_pages'=>max(1, (int)ceil($total / $per)));
    }
    public static function notification_log(WP_REST_Request $r){
        global $wpdb;
        $t = BSMS_DB::table('notifications');
        list($page, $per, $offset) = self::paging($r);
        $where = array('1=1'); $args = array();
        $q = trim(sanitize_text_field((string)$r->get_param('search')));
        if ($q !== '') { $like = '%' . $wpdb->esc_like($q) . '%'; $where[] = '(n.subject LIKE %s OR n.message LIKE %s OR u.display_name LIKE %s OR u.user_email LIKE %s)'; array_push($args, $like, $like, $like, $like); }
        $status = sanitize_key((string)$r->get_param('status'));
        if (in_array($status, array('sent','failed','queued','skipped'), true)) { $where[] = 'n.status=%s'; $args[] = $status; }
        $channel = sanitize_key((string)$r->get_param('channel'));
        if (in_array($channel, array('email','sms'), true)) { $where[] = 'n.channel=%s'; $args[] = $channel; }
        $w = implode(' AND ', $where);
        $from = "FROM {$wpdb->prefix}bsms_notifications n LEFT JOIN {$wpdb->users} u ON u.ID = n.user_id WHERE $w";
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- FROM/WHERE is built from fixed fragments in this function; values use placeholders.
        $total = intval($args ? $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) $from", $args)) : $wpdb->get_var("SELECT COUNT(*) $from"));
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare, WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber, PluginCheck.Security.DirectDB.UnescapedDBParameter -- FROM/WHERE is built from fixed fragments in this function; values use placeholders.
        $rows = $wpdb->get_results($wpdb->prepare("SELECT n.*, u.display_name AS uname, u.user_email AS uemail $from ORDER BY n.id DESC LIMIT %d OFFSET %d", array_merge($args, array($per, $offset))), ARRAY_A);
        $items = array_map(function($x){ return array(
            'id'=>intval($x['id']), 'date'=>$x['sent_at'] ?: $x['created_at'], 'customer'=>array('name'=>$x['uname'] ?: ('User #' . $x['user_id']), 'email'=>(string)$x['uemail']),
            'channel'=>$x['channel'], 'subject'=>$x['subject'], 'message'=>wp_trim_words(wp_strip_all_tags((string)$x['message']), 40), 'status'=>$x['status'], 'cost_kobo'=>intval($x['cost_kobo']),
        ); }, (array)$rows);
        return array('ok'=>true, 'items'=>$items, 'page'=>$page, 'per_page'=>$per, 'total'=>$total, 'total_pages'=>max(1, (int)ceil($total / $per)));
    }

    /* ---------------- Currency Rates ---------------- */
}
