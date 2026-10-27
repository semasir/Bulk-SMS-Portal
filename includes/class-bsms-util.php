<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Util {
    public static function now_gmt(){ return gmdate('Y-m-d H:i:s'); }
    /** A request header or server value, unslashed and cleaned. */
    public static function server_value($key, $fallback = ''){
        return isset($_SERVER[$key]) && is_string($_SERVER[$key]) ? sanitize_text_field(wp_unslash($_SERVER[$key])) : $fallback;
    }

    public static function table($name){ global $wpdb; return $wpdb->prefix . 'bsms_' . $name; }

    public static function brand_name(){
        $brand = trim((string)get_option('bsms_brand_name', get_bloginfo('name')));
        if ($brand === '') {
            return get_bloginfo('name') ?: __('SMS Portal', 'bulk-sms-portal');
        }
        return $brand;
    }

    public static function color_option($key, $fallback){
        $c = trim((string)get_option($key, $fallback));
        return preg_match('/^#[0-9a-fA-F]{6}$/', $c) ? $c : $fallback;
    }

    public static function primary_color(){ return self::color_option('bsms_primary_color', '#008000'); }
    public static function secondary_color(){ return self::color_option('bsms_secondary_color', '#111827'); }

    public static function design_tokens(){
        return array(
            'primary'=>self::primary_color(),
            'secondary'=>method_exists(__CLASS__, 'secondary_color') ? self::secondary_color() : self::color_option('bsms_secondary_color', '#111827'),
            'background'=>self::color_option('bsms_background_color', '#f8fafc'),
            'surface'=>self::color_option('bsms_surface_color', '#ffffff'),
            'text'=>self::color_option('bsms_text_color', '#0f172a'),
            'muted'=>self::color_option('bsms_muted_color', '#64748b'),
            'border'=>self::color_option('bsms_border_color', '#e5e7eb'),
            'alert'=>self::color_option('bsms_alert_color', '#eff6ff'),
            'dashboard_mobile_bg'=>self::color_option('bsms_dashboard_mobile_bg', self::primary_color()),
            'dashboard_mobile_text'=>self::color_option('bsms_dashboard_mobile_text', '#ffffff'),
            'dashboard_heading'=>self::color_option('bsms_dashboard_heading_color', self::color_option('bsms_text_color', '#0f172a')),
            'dashboard_card_bg'=>self::color_option('bsms_dashboard_card_bg', self::color_option('bsms_surface_color', '#ffffff')),
            'dashboard_table_border'=>self::color_option('bsms_dashboard_table_border', self::color_option('bsms_border_color', '#e5e7eb')),
            'responsive_menu_bg'=>self::color_option('bsms_responsive_menu_bg', self::color_option('bsms_surface_color', '#ffffff')),
            'responsive_menu_text'=>self::color_option('bsms_responsive_menu_text', self::color_option('bsms_text_color', '#0f172a')),
            'responsive_menu_active_bg'=>self::color_option('bsms_responsive_menu_active_bg', self::color_option('bsms_alert_color', '#eff6ff')),
            'responsive_menu_active_text'=>self::color_option('bsms_responsive_menu_active_text', self::primary_color()),
            'responsive_menu_accent'=>self::color_option('bsms_responsive_menu_accent', self::primary_color()),
            'responsive_menu_hover_bg'=>self::color_option('bsms_responsive_menu_hover_bg', self::color_option('bsms_alert_color', '#eff6ff'))
        );
    }

    public static function design_style_attr(){
        $t = self::design_tokens();
        $css = '';
        foreach ($t as $k=>$v) $css .= '--bsms-' . $k . ':' . $v . ';';
        return $css;
    }

    /** Canonical customer-facing brand logo resolver.
     *
     * The stored option remains the clean Media Library URL. Rendering goes
     * through this method so every portal/auth surface uses the same source and
     * receives a revision token whenever branding changes. This avoids stale
     * browser/CDN copies after a logo is replaced.
     */
    public static function logo_url_raw(){
        // Media attachment ID is the canonical source for uploaded logos. The URL
        // option remains as a backwards-compatible/manual-URL fallback.
        $attachment_id = absint(get_option('bsms_logo_attachment_id', 0));
        if ($attachment_id) {
            $attachment_url = wp_get_attachment_url($attachment_id);
            // A selected Media Library attachment is canonical. If it is later
            // deleted, do not resurrect a stale historical URL in the portal
            // or in branded email.
            return $attachment_url ? esc_url_raw($attachment_url) : '';
        }
        // Backwards compatibility for installations using an intentional
        // manual URL and no Media Library attachment.
        return esc_url_raw(get_option('bsms_logo_url', ''));
    }

    public static function logo_url(){
        $url = self::logo_url_raw();
        if (!$url) return '';
        $revision = absint(get_option('bsms_logo_revision', 0));
        if ($revision) $url = add_query_arg('bsms_logo_v', $revision, $url);
        return esc_url($url);
    }
    /** v3.6.0: the one shared sender name used when a customer has none approved. */
    public static function shared_sender(){
        $v = self::validate_sender_id(get_option('bsms_default_sender', 'SMS'));
        return $v ?: 'SMS';
    }
    public static function support_email(){ return sanitize_email(get_option('bsms_support_email', get_option('admin_email'))); }

    public static function kobo($naira){
        $naira = trim((string)$naira);
        if ($naira === '') return 0;
        if (!preg_match('/^\d+(\.\d{1,2})?$/', $naira)) return 0;
        $parts = explode('.', $naira, 2);
        $n = intval($parts[0]);
        $k = isset($parts[1]) ? intval(str_pad($parts[1], 2, '0')) : 0;
        return ($n * 100) + $k;
    }

    public static function naira_from_kobo($kobo){
        $kobo = intval($kobo);
        return number_format($kobo / 100, 2, '.', '');
    }

    public static function naira_label($kobo){ return '₦' . self::naira_from_kobo($kobo); }

    public static function money($kobo){ return self::naira_label($kobo); }

    public static function display_name($user_id){
        $u = get_user_by('id', $user_id);
        if (!$u) return __('User', 'bulk-sms-portal');
        $first = get_user_meta($user_id, 'first_name', true);
        return $first ?: ($u->display_name ?: $u->user_login);
    }

    public static function default_country($user_id){
        $cc = preg_replace('/\D+/', '', (string)get_user_meta($user_id, 'bsms_default_country', true));
        return $cc ?: '234';
    }

    /**
     * Normalise recipient phone numbers to provider-safe international digits only.
     *
     * Design rules for white-label/global deployment:
     * - Nigerian local 080..., 070..., 090... => 23480..., 23470..., 23490...
     * - Nigerian short local 802..., 705..., 905... => 234802..., 234705..., 234905...
     * - Existing +234... / 234... => 234... (no + stored/sent)
     * - Existing international +44... / 44... / 1... => preserve country code, remove only symbols
     * - Deduplication, pricing, reporting and provider submission all use the same output.
     */
    public static function normalize_phone_e164($raw, $default_cc){
        $raw = trim((string)$raw);
        if ($raw === '') return '';
        $digits = preg_replace('/\D+/', '', $raw);
        if ($digits === '') return '';
        $default_cc = preg_replace('/\D+/', '', (string)$default_cc) ?: '234';

        // Remove international dialling prefix 00 when supplied, e.g. 0044... => 44...
        if (strpos($digits, '00') === 0 && strlen($digits) > 10) {
            $digits = substr($digits, 2);
        }

        if (strlen($digits) > 15) return '';

        // Already in the configured country-code format, e.g. 234905... or 4477...
        if (strpos($digits, $default_cc) === 0 && strlen($digits) >= strlen($default_cc) + 7) {
            return $digits;
        }

        // Nigeria/default-country local format: 0XXXXXXXXXX => 234XXXXXXXXXX
        if ($default_cc === '234' && preg_match('/^0[789][01]\d{8}$/', $digits)) {
            return '234' . substr($digits, 1);
        }

        // Nigeria/default-country short local format: 802..., 705..., 905... => 234802...
        if ($default_cc === '234' && preg_match('/^[789][01]\d{8}$/', $digits)) {
            return '234' . $digits;
        }

        // Generic local fallback for other configured default countries: strip leading zero and prepend default CC.
        if ($default_cc !== '' && strpos($digits, '0') === 0 && strlen($digits) >= 8 && strlen($digits) <= 12) {
            $local = ltrim($digits, '0');
            // v3.4.1: "00000000" used to become just "234" and was charged as a message.
            return strlen($local) >= 7 ? $default_cc . $local : '';
        }

        // International number already supplied without plus. Preserve as-is if
        // it has a possible length (international numbers have at most 15 digits).
        return (strlen($digits) >= 8 && strlen($digits) <= 15) ? $digits : '';
    }

    public static function clean_provider_phone($raw, $default_cc='234'){
        $normalised = self::normalize_phone_e164($raw, $default_cc);
        return $normalised !== '' ? $normalised : preg_replace('/\D+/', '', (string)$raw);
    }

    /** Text that looks like a date (2023-10-16, 16/10/2023) is never a phone number. */
    private static function looks_like_date($token){
        $t = trim((string)$token);
        return (bool)(preg_match('/^\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}$/', $t) || preg_match('/^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}$/', $t));
    }

    /**
     * Pull phone numbers out of pasted text.
     *
     * v3.4.1: line breaks, commas, semicolons, tabs and pipes always separate
     * numbers. Previously the pattern allowed line breaks inside a number, so a
     * list pasted one number per line was merged into a single long "number":
     * the customer was charged for one message and nobody received it.
     * Dates from pasted spreadsheets are ignored, and a run of several numbers
     * separated only by spaces is split.
     */
    public static function parse_numbers($text){
        $text = (string)$text;
        if (trim($text) === '') return array();
        $out = array();
        foreach (preg_split('/[\r\n,;\t|]+/u', $text) as $segment) {
            if (!preg_match_all('/(?:\+|00)?\d[\d ().\-]{5,}\d/u', $segment, $m)) continue;
            foreach ($m[0] as $token) {
                $token = trim($token);
                if (self::looks_like_date($token)) continue;
                $digits = preg_replace('/\D+/', '', $token);
                if (strlen($digits) > 15 && preg_match('/\s/', $token)) {
                    // Several numbers on one line separated by spaces.
                    $parts = preg_split('/\s+/', $token);
                    $all_long = true;
                    foreach ($parts as $part) if (strlen(preg_replace('/\D+/', '', $part)) < 7) { $all_long = false; break; }
                    if ($all_long) {
                        foreach ($parts as $part) if (!self::looks_like_date($part)) $out[] = trim($part);
                        continue;
                    }
                }
                if (strlen($digits) >= 7) $out[] = $token;
            }
        }
        return $out;
    }

    public static function validate_sender_id($sender){
        $sender = trim(preg_replace('/\s+/', ' ', (string)$sender));
        if ($sender === '' || mb_strlen($sender) > 11) return '';
        return preg_match('/^[A-Za-z0-9 \-\._]+$/', $sender) ? $sender : '';
    }

    /** Canonical SMS encoding/segment calculation used by pricing, wallet charging and API responses. */
    public static function sms_metrics($message){
        $message = (string)$message;
        if ($message === '') return array('encoding'=>'GSM-7','length'=>0,'units'=>0,'pages'=>0,'single_limit'=>160,'multi_limit'=>153);
        // GSM 03.38 basic alphabet plus extension characters. Extension characters consume two septets.
        // GSM-7 basic set used for billing. Accented letters (é, è, à, ñ, ü and similar) are
        // deliberately excluded, so messages containing them are billed as Unicode (70 characters
        // per page), matching how providers bill them. Single quotes stop PHP reading "$" as a
        // variable, which silently dropped "$" and several letters from this list before v3.4.0.
        $basic = '@£$¥' . "\n" . "\r" . 'Δ_ΦΓΛΩΠΨΣΘΞ Ææß!"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ§¿abcdefghijklmnopqrstuvwxyz';
        $ext = "^{}\\[~]|€";
        $chars = preg_split('//u', $message, -1, PREG_SPLIT_NO_EMPTY);
        $gsm = is_array($chars); $septets = 0;
        if ($gsm) foreach ($chars as $ch) {
            if (mb_strpos($basic, $ch, 0, 'UTF-8') !== false) $septets += 1;
            elseif (mb_strpos($ext, $ch, 0, 'UTF-8') !== false) $septets += 2;
            else { $gsm = false; break; }
        }
        if ($gsm) {
            $pages = $septets <= 160 ? 1 : (int)ceil($septets / 153);
            return array('encoding'=>'GSM-7','length'=>mb_strlen($message,'UTF-8'),'units'=>$septets,'pages'=>$pages,'single_limit'=>160,'multi_limit'=>153);
        }
        $len = mb_strlen($message, 'UTF-8');
        // v3.4.2: Unicode SMS are billed in UTF-16 units. Emoji and other
        // characters outside the basic plane take two units each, so a message
        // of 40 emoji is 80 units (2 pages), not 40.
        $units = 0;
        foreach ($chars as $ch) $units += (strlen($ch) === 4) ? 2 : 1; // 4-byte UTF-8 = outside the basic plane
        $pages = $units <= 70 ? 1 : (int)ceil($units / 67);
        return array('encoding'=>__('Unicode', 'bulk-sms-portal'),'length'=>$len,'units'=>$units,'pages'=>$pages,'single_limit'=>70,'multi_limit'=>67);
    }

    public static function sms_pages($message){
        $metrics = self::sms_metrics($message);
        return intval($metrics['pages']);
    }

    public static function status_bucket($status){
        $s = strtoupper(trim((string)$status));
        if (in_array($s, array('DELIVRD','DELIVERED','SUCCESS','SENT'), true)) return 'success';
        if (in_array($s, array('FAILED','ERROR','UNDELIV','REJECTD','EXPIRED','DELETED'), true)) return 'failed';
        return 'pending';
    }


    /** One CSV line (same quoting as fputcsv), built in memory. */
    public static function csv_line($fields){
        $out = array();
        foreach ((array) $fields as $field) {
            $field = (string) $field;
            if (preg_match('/[,"\\\\\s]/', $field)) $field = '"' . str_replace('"', '""', $field) . '"';
            $out[] = $field;
        }
        return implode(',', $out) . "\n";
    }

    public static function parse_csv_numbers($csv_text){
        $numbers = array();
        $csv_text = (string)$csv_text;
        if (trim($csv_text) === '') return $numbers;

        $headers = null;
        foreach (preg_split('/\r\n|\r|\n/', $csv_text) as $text_line) {
            if (trim($text_line) === '') continue;
            $row = str_getcsv($text_line, ',', '"', '\\');
            if (!$row || count(array_filter($row, 'strlen')) === 0) continue;

            if ($headers === null) {
                $possible = array_map('strtolower', array_map('trim', $row));
                $has_header = count(array_intersect($possible, array('phone','number','msisdn','recipient','to','mobile'))) > 0;
                if ($has_header) {
                    $headers = $possible;
                    continue;
                }
                $headers = array();
            }

            $value = '';
            if (!empty($headers)) {
                foreach (array('phone','number','msisdn','recipient','to','mobile') as $key) {
                    $idx = array_search($key, $headers, true);
                    if ($idx !== false && isset($row[$idx])) { $value = $row[$idx]; break; }
                }
            }
            if ($value === '') $value = $row[0] ?? '';
            if (trim((string)$value) !== '') $numbers[] = trim((string)$value);
        }
        return $numbers;
    }

    public static function csv_download_response($filename, $rows, $headers){
        $csv = self::csv_line($headers);
        foreach ($rows as $row) {
            $line = array();
            foreach ($headers as $h) $line[] = isset($row[$h]) ? $row[$h] : '';
            $csv .= self::csv_line($line);
        }

        return new WP_REST_Response(array(
            'ok'=>true,
            'filename'=>$filename,
            'csv'=>$csv
        ), 200);
    }

    public static function bool_param($value){
        return $value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'yes' || $value === 'on';
    }


    /** A page of the portal by its address, e.g. page_url('history'). */
    public static function page_url($route=''){
        $base = class_exists('BSMS_Portal') ? BSMS_Portal::portal_url() : home_url('/portal/');
        return $route ? trailingslashit($base) . trim($route, '/') . '/' : $base;
    }

    public static function portal_url($args=array(), $fragment='fund') {
        $configured = trim((string)get_option('bsms_portal_url', ''));
        // v3.7.1: follows the portal address set in Platform Settings.
        $url = $configured ? $configured : (class_exists('BSMS_Portal') ? BSMS_Portal::portal_url() : home_url('/portal/'));
        if (!empty($args) && is_array($args)) {
            $url = add_query_arg(array_map('sanitize_text_field', $args), $url);
        }
        $fragment = trim((string)$fragment);
        if ($fragment !== '') {
            $url = strtok($url, '#') . '#' . sanitize_key($fragment);
        }
        return esc_url_raw($url);
    }

    public static function payment_return_url($provider='paystack', $status='pending', $reference='') {
        $args = array(
            'bsms_payment' => sanitize_key($provider),
            'payment_status' => sanitize_key($status),
        );
        if ($reference !== '') $args['reference'] = sanitize_text_field($reference);
        return self::portal_url($args, $status === 'success' ? 'transactions' : 'fund');
    }

}
