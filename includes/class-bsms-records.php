<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

// phpcs:disable WordPress.DB.PreparedSQL.NotPrepared, WordPress.DB.PreparedSQL.InterpolatedNotPrepared, PluginCheck.Security.DirectDB.UnescapedDBParameter
// Reports filter by many optional conditions, so WHERE clauses are put together
// from fixed SQL fragments written in this file. Every value a person supplies is
// passed separately through $wpdb->prepare() placeholders (see self::prepare()).

/**
 * v3.4.0 canonical records: Message History, Delivery Reports and Wallet History.
 *
 * One server-side source for the three record pages so admins and customers see
 * the same simple vocabulary:
 *   Messages   -> Successful / Failed / Sending / Not sent
 *   Money      -> Money added / Money used / Money returned
 *
 * Scope is enforced in SQL: platform administrators see every account,
 * customers only ever see rows where user_id is their own ID. Every filter
 * runs on the server across all pages, not just the rows on screen.
 */
class BSMS_Records {
    const MAX_PER_PAGE = 100;
    const MAX_EXPORT = 20000;

    public static function init(){
        add_action('rest_api_init', array(__CLASS__, 'routes'));
    }

    public static function routes(){
        $routes = array(
            '/records/messages' => array('messages', 'history'),
            '/records/messages/export' => array('messages_export', 'history'),
            '/records/reports' => array('reports', 'reports'),
            '/records/reports/export' => array('reports_export', 'reports'),
            '/records/wallet' => array('wallet', 'transactions'),
            '/records/wallet/export' => array('wallet_export', 'transactions'),
        );
        // v3.6.0: Reports & Insights (platform admins only).
        register_rest_route('bsms/v1', '/records/insights', array(
            'methods' => 'GET',
            'callback' => array(__CLASS__, 'insights'),
            'permission_callback' => function(){ return self::is_admin(); },
        ));
        foreach ($routes as $path=>$def) {
            $action = $def[1];
            register_rest_route('bsms/v1', $path, array(
                'methods' => 'GET',
                'callback' => array(__CLASS__, $def[0]),
                'permission_callback' => function() use ($action){ return class_exists('BSMS_REST') && BSMS_REST::can_action($action); },
            ));
        }
    }

    /* ------------------------------------------------------------------
     * Shared helpers
     * ------------------------------------------------------------------ */

    private static function is_admin(){
        return class_exists('BSMS_Capabilities') ? BSMS_Capabilities::can_manage_platform() : current_user_can('manage_options');
    }

    private static function paging(WP_REST_Request $r){
        $page = max(1, intval($r->get_param('page')));
        $per = intval($r->get_param('per_page'));
        if ($per <= 0) $per = 20;
        $per = min(self::MAX_PER_PAGE, $per);
        return array($page, $per, ($page - 1) * $per);
    }

    private static function text_param(WP_REST_Request $r, $key, $max = 120){
        $v = trim(sanitize_text_field((string)$r->get_param($key)));
        return function_exists('mb_substr') ? mb_substr($v, 0, $max) : substr($v, 0, $max);
    }

    private static function like($value){
        global $wpdb;
        return '%' . $wpdb->esc_like($value) . '%';
    }

    /** Convert a local Y-m-d (site timezone) to the GMT bound used in storage. */
    private static function gmt_bound($ymd, $end = false){
        $ymd = (string)$ymd;
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) return '';
        try {
            $tz = wp_timezone();
            $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $ymd, $tz);
            if (!$dt || $dt->format('Y-m-d') !== $ymd) return '';
            if ($end) $dt = $dt->modify('+1 day');
            return $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        } catch (Exception $e) {
            return '';
        }
    }

    /** Add date-range conditions for a GMT datetime column. */
    private static function date_where($column, WP_REST_Request $r, &$where, &$args){
        $from = self::gmt_bound($r->get_param('from'));
        $to = self::gmt_bound($r->get_param('to'), true);
        if ($from !== '') { $where[] = "$column >= %s"; $args[] = $from; }
        if ($to !== '') { $where[] = "$column < %s"; $args[] = $to; }
    }

    /** Admin-only customer filter: numeric ID or part of a name/email/username. */
    private static function customer_where(WP_REST_Request $r, $user_col, $alias, &$where, &$args){
        $customer = self::text_param($r, 'customer');
        if ($customer === '') return;
        if (ctype_digit($customer)) {
            $where[] = "$user_col = %d";
            $args[] = intval($customer);
            return;
        }
        $like = self::like($customer);
        $where[] = "($alias.display_name LIKE %s OR $alias.user_email LIKE %s OR $alias.user_login LIKE %s)";
        array_push($args, $like, $like, $like);
    }

    private static function where_sql($where){
        return $where ? ' WHERE ' . implode(' AND ', array_map(function($w){ return '(' . $w . ')'; }, $where)) : '';
    }

    private static function prepare($sql, $args){
        global $wpdb;
        return $args ? $wpdb->prepare($sql, $args) : $sql;
    }

    private static function local_date($gmt){
        $gmt = (string)$gmt;
        if ($gmt === '' || strpos($gmt, '0000') === 0) return '';
        $ts = strtotime($gmt . ' UTC');
        return $ts ? wp_date('j M Y, g:i a', $ts) : '';
    }

    private static function customer_label($name, $email, $user_id){
        $name = trim((string)$name);
        return array(
            'id' => intval($user_id),
            'name' => $name !== '' ? $name : (sprintf(/* translators: %s: a value filled in when shown */ __('Customer #%s', 'bulk-sms-portal'), intval($user_id))),
            'email' => (string)$email,
        );
    }

    private static function csv($filename, $headers, $rows){
        $csv = BSMS_Util::csv_line($headers);
        foreach ($rows as $row) {
            $line = array();
            foreach ($row as $value) {
                $value = (string)$value;
                // Spreadsheet formula injection guard.
                if ($value !== '' && preg_match('/^[=+\-@\t\r]/', $value) && !preg_match('/^-?\d+(\.\d+)?$/', $value)) $value = "'" . $value;
                $line[] = $value;
            }
            $csv .= BSMS_Util::csv_line($line);
        }
        return array('ok' => true, 'filename' => $filename, 'csv' => $csv);
    }

    private static function naira($kobo){
        return BSMS_Util::naira_from_kobo(intval($kobo));
    }

    /**
     * SQL expression giving each job one plain result:
     * successful | failed | sending | not_sent.
     * Mirrors BSMS_Providers::canonical_job_status() exactly, including the
     * legacy case of a "failed" row whose stored code is a configured success
     * code for its provider.
     */
    /** v3.7.2: a successful message the SMS service did not confirm (no failure reported). */
    private static function no_report_cond($a = 'j'){
        return "(UPPER(COALESCE($a.provider_status,''))='NO_FAILURE_REPORTED')";
    }
    /** Kept for Reports & Insights: successful and confirmed by the service. */
    private static function delivered_cond($a = 'j'){
        return "($a.status_bucket IN ('success','delivered') AND NOT " . self::no_report_cond($a) . ")";
    }

    /**
     * v3.7.2 rule: a message the SMS service accepted is "Sending" until the
     * wait in Platform Settings passes, then "Successful" unless a failure was
     * reported. With $split (admin filter), successful is told apart into
     * 'confirmed' (the service confirmed delivery) and 'no_report'.
     */
    private static function result_sql($a = 'j', $split = false){
        $res = self::result_sql_base($a);
        if (!$split) return $res;
        return "(CASE WHEN $res='successful' AND " . self::no_report_cond($a) . " THEN 'no_report' WHEN $res='successful' THEN 'confirmed' ELSE $res END)";
    }

    private static function result_sql_base($a = 'j'){
        global $wpdb;
        $jobs = BSMS_DB::table('jobs');
        $legacy = array();
        $pairs = $wpdb->get_results("SELECT DISTINCT api_id, err_code FROM {$wpdb->prefix}bsms_jobs WHERE status_bucket='failed' AND api_id>0 AND err_code IS NOT NULL AND err_code<>'' LIMIT 500");
        if ($pairs && class_exists('BSMS_Providers')) {
            $api_rows = array();
            foreach ($pairs as $p) {
                $aid = intval($p->api_id);
                if (!array_key_exists($aid, $api_rows)) {
                    $api_rows[$aid] = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_apis WHERE id=%d", $aid));
                }
                if ($api_rows[$aid] && BSMS_Providers::response_code_is_success($api_rows[$aid], $p->err_code)) {
                    $legacy[] = $wpdb->prepare("($a.api_id=%d AND $a.err_code=%s)", $aid, $p->err_code);
                }
            }
        }
        $legacy_sql = $legacy ? sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s%2$s) THEN \'successful\' ', 'bulk-sms-portal'), "WHEN $a.status_bucket='failed' AND (", implode(' OR ', $legacy)) : '';
        return sprintf(/* translators: %1$s, %2$s, %3$s, %4$s: values filled in when shown */ __('(CASE %1$s%2$s%3$s%4$sELSE \'sending\' END)', 'bulk-sms-portal'), "WHEN $a.status_bucket IN ('success','delivered') THEN 'successful' ", $legacy_sql, "WHEN $a.status_bucket='failed' THEN 'failed' ", "WHEN $a.status_bucket='skipped' THEN 'not_sent' ");
    }

    private static function result_label($result){
        $map = array('confirmed'=>__('Successful', 'bulk-sms-portal'), 'no_report'=>__('Successful', 'bulk-sms-portal'), 'successful'=>__('Successful', 'bulk-sms-portal'), 'failed'=>__('Failed', 'bulk-sms-portal'), 'sending'=>__('Sending', 'bulk-sms-portal'), 'not_sent'=>__('Not sent', 'bulk-sms-portal'));
        return $map[$result] ?? __('Sending', 'bulk-sms-portal');
    }

    /* ------------------------------------------------------------------
     * Message History — one row per text message (per recipient)
     * ------------------------------------------------------------------ */

    private static function message_query(WP_REST_Request $r, $include_result_filter = true){
        global $wpdb;
        $admin = self::is_admin();
        $jobs = BSMS_DB::table('jobs');
        $camps = BSMS_DB::table('campaigns');
        $result = self::result_sql('j');
        $from = "{$wpdb->prefix}bsms_jobs j INNER JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id LEFT JOIN {$wpdb->users} u ON u.ID=j.user_id";
        $where = array(); $args = array();
        if (!$admin) { $where[] = 'j.user_id=%d'; $args[] = get_current_user_id(); }
        $campaign = absint($r->get_param('campaign'));
        if ($campaign) { $where[] = 'j.campaign_id=%d'; $args[] = $campaign; }
        $search = self::text_param($r, 'search');
        if ($search !== '') {
            $like = self::like($search);
            // v3.7.0: the message ID from the SMS service can be searched too.
            $parts = array('c.name LIKE %s', 'c.message LIKE %s', 'j.sender_id LIKE %s', 'j.to_phone_e164 LIKE %s', 'j.recipient LIKE %s', 'j.provider_message_id LIKE %s');
            $pargs = array($like, $like, $like, $like, $like, $like);
            $digits = preg_replace('/\D+/', '', $search);
            if (strlen($digits) >= 4) {
                // Local format typed by people (0803…) matches stored international digits (234803…).
                if (strpos($digits, '0') === 0) { $parts[] = 'j.to_phone_e164 LIKE %s'; $pargs[] = self::like('234' . substr($digits, 1)); }
            }
            if ($admin) {
                array_push($parts, 'u.display_name LIKE %s', 'u.user_email LIKE %s', 'u.user_login LIKE %s');
                array_push($pargs, $like, $like, $like);
            }
            $where[] = implode(' OR ', $parts);
            $args = array_merge($args, $pargs);
        }
        if ($admin) self::customer_where($r, 'j.user_id', 'u', $where, $args);
        self::date_where('c.created_at', $r, $where, $args);
        $status = sanitize_key((string)$r->get_param('status'));
        if ($include_result_filter && in_array($status, array('confirmed','no_report'), true)) {
            $where[] = self::result_sql('j', true) . "=%s";
            $args[] = $status;
        } elseif ($include_result_filter && in_array($status, array('successful','failed','sending','not_sent'), true)) {
            $where[] = "$result=%s";
            $args[] = $status;
        }
        return array($from, $where, $args, $result);
    }

    private static function message_rows(WP_REST_Request $r, $limit, $offset){
        global $wpdb;
        $admin = self::is_admin();
        list($from, $where, $args, $result) = self::message_query($r);
        $sql = "SELECT j.id, j.campaign_id, j.user_id, j.to_phone_e164, j.recipient, j.sender_id, j.route, j.network,
                       j.status_bucket, j.provider_status, j.provider_message_id, j.err_code, j.last_error, j.cost_kobo, j.api_id,
                       j.sent_at, j.delivered_at, c.name AS campaign_name, c.message, c.pages, c.created_at, c.schedule_at,
                       u.display_name AS customer_name, u.user_email AS customer_email, $result AS result
                FROM $from" . self::where_sql($where) . " ORDER BY j.id DESC LIMIT %d OFFSET %d";
        $rows = $wpdb->get_results(self::prepare($sql, array_merge($args, array(intval($limit), intval($offset)))), ARRAY_A);
        if (!$rows) return array();

        // Money for these messages straight from the wallet ledger (the money truth).
        $refs = array();
        foreach ($rows as $row) { $refs[] = 'JOB-' . intval($row['id']); $refs[] = 'REFUND-JOB-' . intval($row['id']); }
        $ledger = BSMS_DB::table('ledger');
        $money = array();
        foreach (array_chunk($refs, 400) as $chunk) {
            foreach ((array)$wpdb->get_results($wpdb->prepare("SELECT reference, amount_kobo FROM {$wpdb->prefix}bsms_ledger WHERE reference IN (" . implode(',', array_fill(0, count($chunk), '%s')) . ")", $chunk), ARRAY_A) as $l) {
                $money[$l['reference']] = intval($l['amount_kobo']);
            }
        }

        $now = time();
        $out = array();
        foreach ($rows as $row) {
            $id = intval($row['id']);
            $res = (string)$row['result'];
            $charged = isset($money['JOB-' . $id]) ? abs($money['JOB-' . $id]) : 0;
            $refunded = isset($money['REFUND-JOB-' . $id]) ? abs($money['REFUND-JOB-' . $id]) : 0;
            $err = strtoupper((string)$row['err_code']);
            $pstatus = strtoupper((string)$row['provider_status']);

            if ($res === 'successful' && $pstatus === 'NO_FAILURE_REPORTED') {
                $detail = __('No failure was reported by the network', 'bulk-sms-portal');
            } elseif ($res === 'successful' && !in_array($row['status_bucket'], array('success','delivered'), true)) {
                $detail = __('Accepted by the network', 'bulk-sms-portal');
            } elseif ($res === 'successful') {
                $detail = __('Delivered to the phone', 'bulk-sms-portal');
            } elseif ($res === 'failed') {
                if ($pstatus === 'NOT_SUBMITTED' && $err === 'INSUFFICIENT_BALANCE') $detail = __('Not sent because the wallet balance was too low', 'bulk-sms-portal');
                elseif ($pstatus === 'NOT_SUBMITTED' && in_array($err, array('NO_API','API_CREDENTIALS_MISSING','API_CREDENTIALS_EMPTY','API_CREDENTIALS_NOT_SAVED'), true)) $detail = __('Not sent: sending is not set up yet. The charge went back to the wallet', 'bulk-sms-portal');
                elseif ($err === 'NO_API') $detail = __('Not sent: sending is not set up yet. The charge went back to the wallet', 'bulk-sms-portal');
                elseif ($err === 'NOT_REACHED') $detail = __('Not sent: the SMS service could not be reached. The charge went back to the wallet', 'bulk-sms-portal');
                elseif ($pstatus === 'NOT_SUBMITTED') $detail = __('Not sent because it could not be processed', 'bulk-sms-portal');
                else $detail = __('The network could not deliver this message', 'bulk-sms-portal');
            } elseif ($res === 'not_sent') {
                $detail = $err === 'DUPLICATE' ? __('Repeated number — this number got the message once', 'bulk-sms-portal') : ($err === 'INVALID_NUMBER' ? __('Not a valid phone number', 'bulk-sms-portal') : ($err === 'NO_RATE' ? __('No price is set for this country, so it was not sent', 'bulk-sms-portal') : __('Skipped', 'bulk-sms-portal')));
            } else {
                $sched = !empty($row['schedule_at']) ? strtotime($row['schedule_at'] . ' UTC') : 0;
                if ($row['status_bucket'] === 'queued' && $sched > $now) $detail = sprintf(/* translators: %s: a value filled in when shown */ __('Scheduled for %s', 'bulk-sms-portal'), self::local_date($row['schedule_at']));
                elseif ($row['status_bucket'] === 'queued') $detail = __('Waiting to send', 'bulk-sms-portal');
                elseif (!empty($row['sent_at']) && class_exists('BSMS_DLR')) {
                    $at = strtotime($row['sent_at'] . ' UTC') + BSMS_DLR::success_after_minutes() * 60;
                    $detail = sprintf(/* translators: %s: a value filled in when shown */ __('Sent to the network. It counts as successful %s unless a failure is reported', 'bulk-sms-portal'), ($at > time() ? 'at ' . self::local_date(gmdate('Y-m-d H:i:s', $at)) : 'shortly'));
                } else $detail = __('Waiting for the network to confirm', 'bulk-sms-portal');
            }

            $item = array(
                'id' => $id,
                'campaign_id' => intval($row['campaign_id']),
                'campaign_name' => (string)$row['campaign_name'],
                'date' => self::local_date($row['created_at']),
                'recipient' => (string)($row['to_phone_e164'] ?: $row['recipient']),
                'sender' => (string)$row['sender_id'],
                'message' => (string)$row['message'],
                'pages' => max(1, intval($row['pages'])),
                'result' => $res,
                'result_label' => self::result_label($res),
                'message_id' => (strpos((string)$row['provider_message_id'], 'LOCAL-') === 0) ? '' : (string)$row['provider_message_id'],
                'detail' => $detail,
                'charged_kobo' => $charged,
                'refunded_kobo' => $refunded,
                'cost_kobo' => max(0, $charged - $refunded),
            );
            if ($admin) {
                $item['customer'] = self::customer_label($row['customer_name'], $row['customer_email'], $row['user_id']);
                static $svc = null;
                if ($svc === null) { $svc = array(); foreach ((array)$wpdb->get_results("SELECT id, name FROM {$wpdb->prefix}bsms_apis", ARRAY_A) as $a) $svc[intval($a['id'])] = (string)$a['name']; }
                $aid = intval($row['api_id'] ?? 0);
                $tech = array_filter(array(
                    $aid ? 'SMS service: ' . ($svc[$aid] ?? ('#' . $aid)) : '',
                    $row['route'] === 'dnd' ? 'Delivery: Do Not Disturb' : '',
                    $row['err_code'] ? 'Code: ' . $row['err_code'] : '',
                    $row['provider_status'] ? 'Network status: ' . $row['provider_status'] : '',
                    ($row['network'] && $row['network'] !== 'all') ? 'Network: ' . $row['network'] : '',
                ));
                $item['technical'] = implode(' · ', $tech);
                $note = (string)$row['last_error'];
                if (strpos($note, 'Pricing:') === 0) $note = '';
                $item['technical_note'] = function_exists('mb_substr') ? mb_substr($note, 0, 300) : substr($note, 0, 300);
            }
            $out[] = $item;
        }
        return $out;
    }

    public static function messages(WP_REST_Request $r){
        global $wpdb;
        list($page, $per, $offset) = self::paging($r);
        // Counts per result ignore the result filter so the summary tiles work as tabs.
        list($from, $where, $args, $result) = self::message_query($r, false);
        if (class_exists('BSMS_DLR')) BSMS_DLR::finalize_no_report(true);
        $counts = array('successful'=>0, 'failed'=>0, 'sending'=>0, 'not_sent'=>0);
        $rows = $wpdb->get_results(self::prepare("SELECT $result AS result, COUNT(*) AS n FROM $from" . self::where_sql($where) . " GROUP BY $result", $args), ARRAY_A);
        foreach ((array)$rows as $row) if (isset($counts[$row['result']])) $counts[$row['result']] = intval($row['n']);
        $status = sanitize_key((string)$r->get_param('status'));
        if (in_array($status, array('confirmed','no_report'), true)) {
            list($f2, $w2, $a2) = self::message_query($r, true);
            $total = intval($wpdb->get_var(self::prepare("SELECT COUNT(*) FROM $f2" . self::where_sql($w2), $a2)));
        } else $total = isset($counts[$status]) ? $counts[$status] : array_sum($counts);
        $items = self::message_rows($r, $per, $offset);
        return array(
            'ok' => true,
            'scope' => self::is_admin() ? 'platform' : 'account',
            'items' => $items,
            'page' => $page,
            'per_page' => $per,
            'total' => $total,
            'total_pages' => max(1, (int)ceil($total / $per)),
            'counts' => $counts + array('all' => array_sum($counts)),
        );
    }

    public static function messages_export(WP_REST_Request $r){
        $admin = self::is_admin();
        $rows = self::message_rows($r, self::MAX_EXPORT, 0);
        $headers = array(__('Date', 'bulk-sms-portal'), __('Recipient', 'bulk-sms-portal'), __('Sender', 'bulk-sms-portal'), __('Message', 'bulk-sms-portal'), __('Pages', 'bulk-sms-portal'), __('Result', 'bulk-sms-portal'), __('Details', 'bulk-sms-portal'), __('Message ID', 'bulk-sms-portal'), __('Charged (NGN)', 'bulk-sms-portal'), __('Returned (NGN)', 'bulk-sms-portal'), __('Send name', 'bulk-sms-portal'));
        if ($admin) array_splice($headers, 1, 0, array(__('Customer', 'bulk-sms-portal'), __('Customer email', 'bulk-sms-portal')));
        $out = array();
        foreach ($rows as $m) {
            $line = array($m['date'], $m['recipient'], $m['sender'], $m['message'], $m['pages'], $m['result_label'], $m['detail'], $m['message_id'], self::naira($m['charged_kobo']), self::naira($m['refunded_kobo']), $m['campaign_name']);
            if ($admin) array_splice($line, 1, 0, array($m['customer']['name'], $m['customer']['email']));
            $out[] = $line;
        }
        return self::csv(($admin ? 'platform-messages-' : 'my-messages-') . wp_date('Y-m-d') . '.csv', $headers, $out);
    }

    /* ------------------------------------------------------------------
     * Delivery Reports — one row per send (campaign)
     * ------------------------------------------------------------------ */

    private static function report_query(WP_REST_Request $r){
        global $wpdb;
        $admin = self::is_admin();
        $jobs = BSMS_DB::table('jobs');
        $camps = BSMS_DB::table('campaigns');
        $ledger = BSMS_DB::table('ledger');
        $res = self::result_sql('j');
        $where = array(); $args = array();
        if (!$admin) { $where[] = 'c.user_id=%d'; $args[] = get_current_user_id(); }
        $campaign = absint($r->get_param('campaign'));
        if ($campaign) { $where[] = 'c.id=%d'; $args[] = $campaign; }
        $search = self::text_param($r, 'search');
        if ($search !== '') {
            $like = self::like($search);
            $parts = array('c.name LIKE %s', 'c.message LIKE %s', 'c.sender_id LIKE %s');
            $pargs = array($like, $like, $like);
            if (ctype_digit($search)) { $parts[] = 'c.id=%d'; $pargs[] = intval($search); }
            if ($admin) {
                array_push($parts, 'u.display_name LIKE %s', 'u.user_email LIKE %s', 'u.user_login LIKE %s');
                array_push($pargs, $like, $like, $like);
            }
            $where[] = implode(' OR ', $parts);
            $args = array_merge($args, $pargs);
        }
        if ($admin) self::customer_where($r, 'c.user_id', 'u', $where, $args);
        self::date_where('c.created_at', $r, $where, $args);

        $grouped = "SELECT c.id, c.user_id, c.name, c.message, c.sender_id, c.created_at, c.schedule_at, c.pages,
                MAX(u.display_name) AS customer_name, MAX(u.user_email) AS customer_email,
                SUM(CASE WHEN $res='successful' THEN 1 ELSE 0 END) AS successful,
                SUM(CASE WHEN $res='successful' AND " . self::delivered_cond('j') . " THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN $res='failed' THEN 1 ELSE 0 END) AS failed,
                SUM(CASE WHEN $res='sending' THEN 1 ELSE 0 END) AS sending,
                SUM(CASE WHEN $res='not_sent' THEN 1 ELSE 0 END) AS not_sent,
                COALESCE(SUM(CASE WHEN lc.amount_kobo<0 THEN -lc.amount_kobo ELSE 0 END),0) AS charged_kobo,
                COALESCE(SUM(CASE WHEN lr.amount_kobo>0 THEN lr.amount_kobo ELSE 0 END),0) AS refunded_kobo
            FROM {$wpdb->prefix}bsms_campaigns c
            LEFT JOIN {$wpdb->users} u ON u.ID=c.user_id
            LEFT JOIN {$wpdb->prefix}bsms_jobs j ON j.campaign_id=c.id
            LEFT JOIN {$wpdb->prefix}bsms_ledger lc ON lc.reference=CONCAT('JOB-', j.id) AND lc.user_id=j.user_id
            LEFT JOIN {$wpdb->prefix}bsms_ledger lr ON lr.reference=CONCAT('REFUND-JOB-', j.id) AND lr.user_id=j.user_id"
            . self::where_sql($where)
            . " GROUP BY c.id, c.user_id, c.name, c.message, c.sender_id, c.created_at, c.schedule_at, c.pages";

        $status = sanitize_key((string)$r->get_param('status'));
        $having = '';
        if ($status === 'failed') $having = ' HAVING SUM(CASE WHEN ' . $res . "='failed' THEN 1 ELSE 0 END)>0";
        elseif ($status === 'sending') $having = ' HAVING SUM(CASE WHEN ' . $res . "='sending' THEN 1 ELSE 0 END)>0";
        elseif ($status === 'successful') $having = ' HAVING SUM(CASE WHEN ' . $res . "='failed' THEN 1 ELSE 0 END)=0 AND SUM(CASE WHEN " . $res . "='sending' THEN 1 ELSE 0 END)=0 AND SUM(CASE WHEN " . $res . "='successful' THEN 1 ELSE 0 END)>0";
        return array($grouped . $having, $args);
    }

    private static function report_item($row, $admin){
        $successful = intval($row['successful']);
        $failed = intval($row['failed']);
        $sending = intval($row['sending']);
        $charged = intval($row['charged_kobo']);
        $refunded = intval($row['refunded_kobo']);
        $messages = $successful + $failed + $sending;
        if ($sending > 0) {
            $sched = !empty($row['schedule_at']) ? strtotime($row['schedule_at'] . ' UTC') : 0;
            $state = $sched > time() && $successful + $failed === 0 ? 'scheduled' : 'sending';
        } elseif ($messages === 0) $state = 'not_sent';
        elseif ($failed === 0) $state = 'done';
        elseif ($successful === 0) $state = 'all_failed';
        else $state = 'some_failed';
        $labels = array(
            'scheduled' => __('Scheduled', 'bulk-sms-portal'),
            'sending' => __('Still sending', 'bulk-sms-portal'),
            'done' => __('All successful', 'bulk-sms-portal'),
            'some_failed' => __('Some failed', 'bulk-sms-portal'),
            'all_failed' => __('All failed', 'bulk-sms-portal'),
            'not_sent' => __('Nothing sent', 'bulk-sms-portal'),
        );
        $item = array(
            'id' => intval($row['id']),
            'name' => (string)$row['name'],
            'message' => (string)$row['message'],
            'sender' => (string)$row['sender_id'],
            'date' => self::local_date($row['created_at']),
            'scheduled_for' => (!empty($row['schedule_at']) && $state === 'scheduled') ? self::local_date($row['schedule_at']) : '',
            'pages' => max(1, intval($row['pages'])),
            'messages' => $messages,
            'successful' => $successful,
            'confirmed' => intval($row['delivered'] ?? 0),
            'failed' => $failed,
            'sending' => $sending,
            'not_sent' => intval($row['not_sent']),
            'charged_kobo' => $charged,
            'refunded_kobo' => $refunded,
            'cost_kobo' => max(0, $charged - $refunded),
            'state' => $state,
            'state_label' => $labels[$state],
        );
        if ($admin) $item['customer'] = self::customer_label($row['customer_name'], $row['customer_email'], $row['user_id']);
        return $item;
    }

    public static function reports(WP_REST_Request $r){
        if (class_exists('BSMS_DLR')) BSMS_DLR::finalize_no_report(true);
        global $wpdb;
        $admin = self::is_admin();
        list($page, $per, $offset) = self::paging($r);
        list($grouped, $args) = self::report_query($r);
        $sum = $wpdb->get_row(self::prepare("SELECT COUNT(*) AS sends, COALESCE(SUM(successful),0) AS successful, COALESCE(SUM(delivered),0) AS delivered, COALESCE(SUM(failed),0) AS failed,
                COALESCE(SUM(sending),0) AS sending, COALESCE(SUM(not_sent),0) AS not_sent,
                COALESCE(SUM(charged_kobo),0) AS charged_kobo, COALESCE(SUM(refunded_kobo),0) AS refunded_kobo
            FROM ($grouped) t", $args), ARRAY_A);
        $rows = $wpdb->get_results(self::prepare($grouped . ' ORDER BY c.id DESC LIMIT %d OFFSET %d', array_merge($args, array($per, $offset))), ARRAY_A);
        $items = array();
        foreach ((array)$rows as $row) $items[] = self::report_item($row, $admin);
        $total = intval($sum['sends'] ?? 0);
        $charged = intval($sum['charged_kobo'] ?? 0);
        $refunded = intval($sum['refunded_kobo'] ?? 0);
        return array(
            'ok' => true,
            'scope' => $admin ? 'platform' : 'account',
            'items' => $items,
            'page' => $page,
            'per_page' => $per,
            'total' => $total,
            'total_pages' => max(1, (int)ceil($total / $per)),
            'summary' => array(
                'sends' => $total,
                'messages' => intval($sum['successful'] ?? 0) + intval($sum['failed'] ?? 0) + intval($sum['sending'] ?? 0),
                'successful' => intval($sum['successful'] ?? 0),
                'confirmed' => intval($sum['delivered'] ?? 0),
                'failed' => intval($sum['failed'] ?? 0),
                'sending' => intval($sum['sending'] ?? 0),
                'not_sent' => intval($sum['not_sent'] ?? 0),
                'charged_kobo' => $charged,
                'refunded_kobo' => $refunded,
                'cost_kobo' => max(0, $charged - $refunded),
            ),
        );
    }

    public static function reports_export(WP_REST_Request $r){
        global $wpdb;
        $admin = self::is_admin();
        list($grouped, $args) = self::report_query($r);
        $rows = $wpdb->get_results(self::prepare($grouped . ' ORDER BY c.id DESC LIMIT %d', array_merge($args, array(self::MAX_EXPORT))), ARRAY_A);
        $headers = array(__('Send #', 'bulk-sms-portal'), __('Date', 'bulk-sms-portal'), __('Name', 'bulk-sms-portal'), __('Sender', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Successful', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal'), __('Still sending', 'bulk-sms-portal'), __('Not sent', 'bulk-sms-portal'), __('Charged (NGN)', 'bulk-sms-portal'), __('Refunded (NGN)', 'bulk-sms-portal'), __('Final cost (NGN)', 'bulk-sms-portal'), __('Status', 'bulk-sms-portal'));
        if ($admin) array_splice($headers, 2, 0, array(__('Customer', 'bulk-sms-portal'), __('Customer email', 'bulk-sms-portal')));
        $out = array();
        foreach ((array)$rows as $row) {
            $x = self::report_item($row, $admin);
            $line = array($x['id'], $x['date'], $x['name'], $x['sender'], $x['messages'], $x['successful'], $x['failed'], $x['sending'], $x['not_sent'], self::naira($x['charged_kobo']), self::naira($x['refunded_kobo']), self::naira($x['cost_kobo']), $x['state_label']);
            if ($admin) array_splice($line, 2, 0, array($x['customer']['name'], $x['customer']['email']));
            $out[] = $line;
        }
        return self::csv(($admin ? 'platform-delivery-reports-' : 'my-delivery-reports-') . wp_date('Y-m-d') . '.csv', $headers, $out);
    }

    /* ------------------------------------------------------------------
     * Wallet History — SMS charges and refunds grouped per send
     * ------------------------------------------------------------------ */

    private static function wallet_query(WP_REST_Request $r){
        global $wpdb;
        $admin = self::is_admin();
        $ledger = BSMS_DB::table('ledger');
        $jobs = BSMS_DB::table('jobs');
        $camps = BSMS_DB::table('campaigns');
        $job_id = __("(CASE WHEN SUBSTRING(l.reference,1,4)='JOB-' THEN CAST(SUBSTRING(l.reference,5) AS UNSIGNED) WHEN SUBSTRING(l.reference,1,11)='REFUND-JOB-' THEN CAST(SUBSTRING(l.reference,12) AS UNSIGNED) ELSE 0 END)", 'bulk-sms-portal');
        $from = "{$wpdb->prefix}bsms_ledger l
            LEFT JOIN {$wpdb->prefix}bsms_jobs j ON j.id=$job_id AND j.user_id=l.user_id
            LEFT JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id
            LEFT JOIN {$wpdb->users} u ON u.ID=l.user_id";
        $is_refund = "(l.type IN ('sms_refund','notification_sms_refund') OR SUBSTRING(l.reference,1,7)='REFUND-')";
        $group = "(CASE WHEN j.id IS NOT NULL THEN CONCAT(CASE WHEN l.amount_kobo<0 THEN 'used-' ELSE 'returned-' END, j.campaign_id) ELSE CONCAT('row-', l.id) END)";
        $where = array(); $args = array();
        if (!$admin) { $where[] = 'l.user_id=%d'; $args[] = get_current_user_id(); }
        $type = sanitize_key((string)$r->get_param('type'));
        if ($type === 'added') $where[] = "l.amount_kobo>0 AND NOT $is_refund";
        elseif ($type === 'used') $where[] = 'l.amount_kobo<0';
        elseif ($type === 'returned') $where[] = "l.amount_kobo>0 AND $is_refund";
        $search = self::text_param($r, 'search');
        if ($search !== '') {
            $like = self::like($search);
            $parts = array('l.reference LIKE %s', 'l.comments LIKE %s', 'c.name LIKE %s');
            $pargs = array($like, $like, $like);
            if ($admin) {
                array_push($parts, 'u.display_name LIKE %s', 'u.user_email LIKE %s', 'u.user_login LIKE %s');
                array_push($pargs, $like, $like, $like);
            }
            $where[] = implode(' OR ', $parts);
            $args = array_merge($args, $pargs);
        }
        if ($admin) self::customer_where($r, 'l.user_id', 'u', $where, $args);
        self::date_where('l.created_at', $r, $where, $args);
        $grouped = "SELECT $group AS grp, MIN(l.user_id) AS user_id, COUNT(*) AS items, SUM(l.amount_kobo) AS amount_kobo,
                MAX(l.created_at) AS created_at, MAX(l.id) AS last_id, MIN(l.type) AS type, MIN(l.reference) AS reference,
                MIN(l.wallet) AS wallet, MIN(l.comments) AS comments, MIN(l.meta_json) AS meta_json,
                MIN(j.campaign_id) AS campaign_id, MIN(c.name) AS campaign_name,
                MIN(u.display_name) AS customer_name, MIN(u.user_email) AS customer_email,
                MAX(CASE WHEN $is_refund THEN 1 ELSE 0 END) AS is_refund
            FROM $from" . self::where_sql($where) . " GROUP BY $group";
        return array($grouped, $args);
    }

    /** Plain-language description of one wallet line. */
    private static function wallet_describe($row, $admin){
        $amount = intval($row['amount_kobo']);
        $type = (string)$row['type'];
        $ref = (string)$row['reference'];
        $items = intval($row['items']);
        $meta = json_decode((string)$row['meta_json'], true);
        if (!is_array($meta)) $meta = array();
        $campaign = trim((string)$row['campaign_name']);
        $send = $campaign !== '' ? '“' . $campaign . '”' : (sprintf(/* translators: %s: a value filled in when shown */ __('send #%s', 'bulk-sms-portal'), intval($row['campaign_id'])));
        $plural = function($n, $word){ return $n . ' ' . $word . ($n === 1 ? '' : 's'); };

        if (strpos((string)$row['grp'], 'used-') === 0) {
            return array('kind'=>'used', 'title'=>__('SMS sent', 'bulk-sms-portal'), 'detail'=>$plural($items, 'message') . ' · ' . $send);
        }
        if (strpos((string)$row['grp'], 'returned-') === 0) {
            return array('kind'=>'returned', 'title'=>__('Refund for failed messages', 'bulk-sms-portal'), 'detail'=>$plural($items, 'message') . ' · ' . $send);
        }
        if ($type === 'notification_sms_charge') return array('kind'=>'used', 'title'=>__('Account alert by SMS', 'bulk-sms-portal'), 'detail'=>__('Text alert sent to your phone', 'bulk-sms-portal'));
        if ($type === 'notification_sms_refund') return array('kind'=>'returned', 'title'=>__('Account alert refunded', 'bulk-sms-portal'), 'detail'=>__('The alert could not be sent', 'bulk-sms-portal'));
        if (!empty($row['is_refund'])) return array('kind'=>'returned', 'title'=>__('Money returned', 'bulk-sms-portal'), 'detail'=>'');

        $reason = trim((string)($meta['reason'] ?? ''));
        if (strpos($ref, 'ADMIN-') === 0) {
            $title = $amount >= 0 ? __('Balance added by support', 'bulk-sms-portal') : __('Balance removed by support', 'bulk-sms-portal');
            $detail = $reason !== '' && $reason !== 'Manual wallet adjustment' ? $reason : __('Manual adjustment', 'bulk-sms-portal');
            if ($admin && !empty($meta['admin'])) {
                $by = get_user_by('id', intval($meta['admin']));
                if ($by) $detail .= sprintf(/* translators: %s: a value filled in when shown */ __(' · by %s', 'bulk-sms-portal'), $by->display_name);
            }
            return array('kind'=>$amount >= 0 ? 'added' : 'used', 'title'=>$title, 'detail'=>$detail);
        }
        if ($amount < 0) return array('kind'=>'used', 'title'=>__('Money used', 'bulk-sms-portal'), 'detail'=>(string)$row['comments']);
        if (strpos($ref, 'WELCOME-') === 0) return array('kind'=>'added', 'title'=>__('Welcome bonus', 'bulk-sms-portal'), 'detail'=>!empty($meta['units']) ? sprintf(/* translators: %s: a value filled in when shown */ __('%s free SMS', 'bulk-sms-portal'), intval($meta['units'])) : __('Free starting credit', 'bulk-sms-portal'));
        if (strpos($ref, 'FUND-APPROVED-MANUAL-') === 0) return array('kind'=>'added', 'title'=>__('Bank transfer approved', 'bulk-sms-portal'), 'detail'=>__('Your transfer was confirmed', 'bulk-sms-portal'));
        if (strpos($ref, 'FUND-APPROVED-') === 0) return array('kind'=>'added', 'title'=>__('Payment approved', 'bulk-sms-portal'), 'detail'=>__('Confirmed by support', 'bulk-sms-portal'));
        if (strpos($ref, 'WC-') === 0) return array('kind'=>'added', 'title'=>__('Store order payment', 'bulk-sms-portal'), 'detail'=>sprintf(/* translators: %s: a value filled in when shown */ __('Order #%s', 'bulk-sms-portal'), substr($ref, 3)));
        if (strpos($ref, 'SUB-') === 0) return array('kind'=>'added', 'title'=>__('Plan credit', 'bulk-sms-portal'), 'detail'=>__('Included with your plan', 'bulk-sms-portal'));
        if (strpos($ref, 'TOPUP-') === 0) return array('kind'=>'added', 'title'=>__('Scheduled top-up', 'bulk-sms-portal'), 'detail'=>__('Added by your account manager', 'bulk-sms-portal'));
        $provider = strtolower((string)($meta['provider'] ?? ''));
        if ($provider === 'paystack' || strpos($ref, 'BSMS-') === 0) return array('kind'=>'added', 'title'=>__('Wallet top-up', 'bulk-sms-portal'), 'detail'=>__('Paid online with Paystack', 'bulk-sms-portal'));
        if ($provider === 'flutterwave') return array('kind'=>'added', 'title'=>__('Wallet top-up', 'bulk-sms-portal'), 'detail'=>__('Paid online with Flutterwave', 'bulk-sms-portal'));
        if ($type === 'bonus_credit') return array('kind'=>'added', 'title'=>__('Bonus added', 'bulk-sms-portal'), 'detail'=>'');
        return array('kind'=>'added', 'title'=>__('Money added', 'bulk-sms-portal'), 'detail'=>(string)$row['comments']);
    }

    private static function wallet_item($row, $admin){
        $d = self::wallet_describe($row, $admin);
        $grouped = strpos((string)$row['grp'], 'row-') !== 0;
        $item = array(
            'key' => (string)$row['grp'],
            'date' => self::local_date($row['created_at']),
            'kind' => $d['kind'],
            'kind_label' => array('added'=>__('Money added', 'bulk-sms-portal'), 'used'=>__('Money used', 'bulk-sms-portal'), 'returned'=>__('Money returned', 'bulk-sms-portal'))[$d['kind']],
            'title' => $d['title'],
            'detail' => $d['detail'],
            'amount_kobo' => intval($row['amount_kobo']),
            'reference' => $grouped ? (sprintf(/* translators: %s: a value filled in when shown */ __('Send #%s', 'bulk-sms-portal'), intval($row['campaign_id']))) : (string)$row['reference'],
            'campaign_id' => $grouped ? intval($row['campaign_id']) : 0,
            'items' => intval($row['items']),
        );
        if ($admin) $item['customer'] = self::customer_label($row['customer_name'], $row['customer_email'], $row['user_id']);
        return $item;
    }

    public static function wallet(WP_REST_Request $r){
        global $wpdb;
        $admin = self::is_admin();
        list($page, $per, $offset) = self::paging($r);
        list($grouped, $args) = self::wallet_query($r);
        $sum = $wpdb->get_row(self::prepare("SELECT COUNT(*) AS lines_total,
                COALESCE(SUM(CASE WHEN amount_kobo>0 AND is_refund=0 THEN amount_kobo ELSE 0 END),0) AS added_kobo,
                COALESCE(SUM(CASE WHEN amount_kobo<0 THEN -amount_kobo ELSE 0 END),0) AS used_kobo,
                COALESCE(SUM(CASE WHEN amount_kobo>0 AND is_refund=1 THEN amount_kobo ELSE 0 END),0) AS returned_kobo,
                COUNT(DISTINCT user_id) AS customers
            FROM ($grouped) t", $args), ARRAY_A);
        $rows = $wpdb->get_results(self::prepare($grouped . ' ORDER BY created_at DESC, last_id DESC LIMIT %d OFFSET %d', array_merge($args, array($per, $offset))), ARRAY_A);
        $items = array();
        foreach ((array)$rows as $row) $items[] = self::wallet_item($row, $admin);
        $total = intval($sum['lines_total'] ?? 0);
        $summary = array(
            'added_kobo' => intval($sum['added_kobo'] ?? 0),
            'used_kobo' => intval($sum['used_kobo'] ?? 0),
            'returned_kobo' => intval($sum['returned_kobo'] ?? 0),
        );
        if ($admin) {
            $summary['customers'] = intval($sum['customers'] ?? 0);
            $summary['net_sms_income_kobo'] = max(0, $summary['used_kobo'] - $summary['returned_kobo']);
        } else {
            $summary['balance_kobo'] = BSMS_Wallet::get_balance_kobo(get_current_user_id());
        }
        return array(
            'ok' => true,
            'scope' => $admin ? 'platform' : 'account',
            'items' => $items,
            'page' => $page,
            'per_page' => $per,
            'total' => $total,
            'total_pages' => max(1, (int)ceil($total / $per)),
            'summary' => $summary,
        );
    }

    public static function wallet_export(WP_REST_Request $r){
        global $wpdb;
        $admin = self::is_admin();
        list($grouped, $args) = self::wallet_query($r);
        $rows = $wpdb->get_results(self::prepare($grouped . ' ORDER BY created_at DESC, last_id DESC LIMIT %d', array_merge($args, array(self::MAX_EXPORT))), ARRAY_A);
        $headers = array(__('Date', 'bulk-sms-portal'), __('Activity', 'bulk-sms-portal'), __('Description', 'bulk-sms-portal'), __('Details', 'bulk-sms-portal'), __('Amount (NGN)', 'bulk-sms-portal'), __('Reference', 'bulk-sms-portal'));
        if ($admin) array_splice($headers, 1, 0, array(__('Customer', 'bulk-sms-portal'), __('Customer email', 'bulk-sms-portal')));
        $out = array();
        foreach ((array)$rows as $row) {
            $x = self::wallet_item($row, $admin);
            $line = array($x['date'], $x['kind_label'], $x['title'], $x['detail'], self::naira($x['amount_kobo']), $x['reference']);
            if ($admin) array_splice($line, 1, 0, array($x['customer']['name'], $x['customer']['email']));
            $out[] = $line;
        }
        return self::csv(($admin ? 'platform-wallet-history-' : 'my-wallet-history-') . wp_date('Y-m-d') . '.csv', $headers, $out);
    }

    /**
     * v3.6.0 Reports & Insights: day-by-day messages, top customers, top
     * sender names, SMS service results and new customers for a period.
     * Totals for messages and money come from /records/reports and
     * /records/wallet with the same from/to, so every page agrees.
     */
    public static function insights(WP_REST_Request $r){
        if (class_exists('BSMS_DLR')) BSMS_DLR::finalize_no_report(true);
        global $wpdb;
        if (!self::is_admin()) return new WP_REST_Response(array('ok'=>false,'error'=>__('Not allowed.', 'bulk-sms-portal')), 403);
        $days = intval($r->get_param('days'));
        if (!in_array($days, array(7, 30, 90, 365), true)) $days = 30;
        $tz = wp_timezone();
        $start_local = (new DateTimeImmutable('today', $tz))->modify('-' . ($days - 1) . ' days');
        $from = $start_local->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        $offset = $tz->getOffset(new DateTime('now', $tz));
        $jobs = BSMS_DB::table('jobs'); $camps = BSMS_DB::table('campaigns'); $apis = BSMS_DB::table('apis');
        $result = self::result_sql('j');
        $local = $wpdb->prepare('DATE(DATE_ADD(c.created_at, INTERVAL %d SECOND))', $offset);

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT $local AS d, $result AS res, COUNT(*) AS n FROM {$wpdb->prefix}bsms_jobs j JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id
             WHERE c.created_at >= %s GROUP BY d, res", $from), ARRAY_A);
        $series = array();
        for ($i = 0; $i < $days; $i++) {
            $d = $start_local->modify("+$i days")->format('Y-m-d');
            $series[$d] = array('date'=>$d, 'successful'=>0, 'failed'=>0, 'sending'=>0, 'not_sent'=>0);
        }
        foreach ((array)$rows as $row) {
            $d = (string)$row['d'];
            if (!isset($series[$d])) continue;
            $k = in_array($row['res'], array('successful','failed','sending','not_sent'), true) ? $row['res'] : 'sending';
            $series[$d][$k] += intval($row['n']);
        }

        $top_customers = $wpdb->get_results($wpdb->prepare(
            "SELECT j.user_id, u.display_name AS name, u.user_email AS email, COUNT(*) AS messages,
                    SUM(CASE WHEN $result='successful' THEN 1 ELSE 0 END) AS successful,
                    SUM(CASE WHEN $result='failed' THEN 1 ELSE 0 END) AS failed,
                    SUM(CASE WHEN $result='failed' THEN 0 ELSE j.cost_kobo END) AS spend_kobo
             FROM {$wpdb->prefix}bsms_jobs j JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id LEFT JOIN {$wpdb->users} u ON u.ID=j.user_id
             WHERE c.created_at >= %s AND j.status_bucket<>'skipped'
             GROUP BY j.user_id, u.display_name, u.user_email ORDER BY spend_kobo DESC, messages DESC LIMIT 8", $from), ARRAY_A);

        $top_senders = $wpdb->get_results($wpdb->prepare(
            "SELECT COALESCE(NULLIF(j.sender_id,''),'(none)') AS sender, COUNT(*) AS messages,
                    SUM(CASE WHEN $result='successful' THEN 1 ELSE 0 END) AS successful,
                    SUM(CASE WHEN $result='successful' AND " . self::delivered_cond('j') . " THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN $result='failed' THEN 1 ELSE 0 END) AS failed
             FROM {$wpdb->prefix}bsms_jobs j JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id
             WHERE c.created_at >= %s AND j.status_bucket<>'skipped'
             GROUP BY sender ORDER BY messages DESC LIMIT 8", $from), ARRAY_A);

        $services = $wpdb->get_results($wpdb->prepare(
            "SELECT j.api_id, COALESCE(a.name,'Not sent to a service') AS name, COUNT(*) AS messages,
                    SUM(CASE WHEN $result='successful' THEN 1 ELSE 0 END) AS successful,
                    SUM(CASE WHEN $result='successful' AND " . self::delivered_cond('j') . " THEN 1 ELSE 0 END) AS delivered,
                    SUM(CASE WHEN $result='failed' THEN 1 ELSE 0 END) AS failed,
                    SUM(CASE WHEN $result='sending' THEN 1 ELSE 0 END) AS sending
             FROM {$wpdb->prefix}bsms_jobs j JOIN {$wpdb->prefix}bsms_campaigns c ON c.id=j.campaign_id LEFT JOIN {$wpdb->prefix}bsms_apis a ON a.id=j.api_id
             WHERE c.created_at >= %s AND j.status_bucket<>'skipped'
             GROUP BY j.api_id, a.name ORDER BY messages DESC LIMIT 10", $from), ARRAY_A);

        $new_customers = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->users} WHERE user_registered >= %s", $from)));
        $active_customers = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT c.user_id) FROM {$wpdb->prefix}bsms_campaigns c WHERE c.created_at >= %s", $from)));

        $ints = function($list, $keys){ return array_map(function($x) use ($keys){ foreach ($keys as $k) $x[$k] = intval($x[$k] ?? 0); return $x; }, (array)$list); };
        return array(
            'ok' => true,
            'days' => $days,
            'from' => $start_local->format('Y-m-d'),
            'to' => (new DateTimeImmutable('today', $tz))->format('Y-m-d'),
            'series' => array_values($series),
            'top_customers' => $ints($top_customers, array('user_id','messages','successful','failed','spend_kobo')),
            'top_senders' => $ints($top_senders, array('messages','successful','delivered','failed')),
            'services' => $ints($services, array('api_id','messages','successful','delivered','failed','sending')),
            'new_customers' => $new_customers,
            'active_customers' => $active_customers,
        );
    }
}
