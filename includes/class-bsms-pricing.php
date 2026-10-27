<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_Pricing {
    /*
     * v3.4.2 request caches. Pricing a send used to run 8 database queries per
     * recipient (including table-structure checks), so large sends and cost
     * estimates timed out. Lookups are now cached for the length of a request.
     */
    private static $schema_checked = array();
    private static $country_codes = null;
    private static $network_map = null;
    private static $prefix_rows = array();
    private static $rule_cache = array();
    private static $index = null;


    public static function flush_cache(){
        self::$country_codes = null;
        self::$network_map = null;
        self::$prefix_rows = array();
        self::$rule_cache = array();
        self::$index = null;
    }
    /** The price a customer pays for one SMS page (add-ons can adjust it per customer). */
    public static function customer_price_kobo($base, $user_id){
        $base = max(0, intval($base));
        return max(0, intval(apply_filters('bsms_customer_price_kobo', $base, absint($user_id))));
    }
    /**
     * v3.6.2: the price of one standard SMS page to a Nigerian number, as set in
     * Pricing Manager. Used where something is measured "in SMS" (free SMS for
     * new customers, alert overdraft). Falls back to the old setting.
     */
    public static function base_unit_kobo(){
        $idx = self::index();
        if (!empty($idx['234']['std'])) return intval($idx['234']['std']);
        $v = intval(get_option('bsms_base_unit_price_kobo', 1000));
        return $v > 0 ? $v : 1000;
    }

    public static function route($route){
        // One route normaliser for pricing, sending, admin and public portal.
        if (class_exists('BSMS_Providers')) {
            return BSMS_Providers::normalise_route($route);
        }
        $route = strtolower(trim((string)$route));
        if (in_array($route, array('premium','dnd','dnd_bypass'), true)) return 'dnd';
        if (in_array($route, array('intl','international'), true)) return 'international';
        return 'normal';
    }

    public static function network_key($network){
        $network = sanitize_text_field((string)$network);
        $network = trim(preg_replace('/\s+/', ' ', $network));
        return $network !== '' ? $network : 'all';
    }

    public static function country_code_from_phone($e164){
        $digits = preg_replace('/\D+/', '', (string)$e164);
        if ($digits === '') return '234';
        if (strpos($digits, '234') === 0) return '234';
        // Countries with a price in Pricing Manager, longest code first (1 vs 1876).
        foreach (self::priced_country_codes() as $code) {
            if ($code !== '234' && strpos($digits, $code) === 0) return $code;
        }
        return 'INTL';
    }

    /** Country codes that have at least one active price. */
    public static function priced_country_codes(){
        if (self::$country_codes === null) {
            $codes = array_map('strval', array_keys(self::index()));
            usort($codes, function($a, $b){ return strlen($b) <=> strlen($a); });
            self::$country_codes = $codes;
        }
        return self::$country_codes;
    }

    /** Full-number form of a prefix: 803 / 0803 / 234803 -> 234803. */
    public static function full_prefixes($raw, $country_code){
        $cc = preg_replace('/\D+/', '', (string)$country_code);
        $out = array();
        foreach (self::normalise_prefixes($raw, $cc) as $local) {
            $full = $cc . preg_replace('/\D+/', '', (string)$local);
            if ($full !== $cc && !in_array($full, $out, true)) $out[] = $full;
        }
        return $out;
    }

    /**
     * v3.6.2 price list, built once per request:
     * [country code => ['std'=>kobo|null, 'dnd'=>kobo|null,
     *   'entries'=>[['name', 'prefixes'=>[full digits], 'std', 'dnd']]]]
     * Country rows are scope "flat"; network and single-prefix rows are scope
     * "network" or "prefix" with their prefixes. Quantity is not used.
     */
    public static function index(){
        if (self::$index !== null) return self::$index;
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        $idx = array();
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) !== $t) return self::$index = $idx;
        self::ensure_pricing_prefix_column();
        $rows = (array)$wpdb->get_results("SELECT id, country_code, scope, network, route, prefixes, price_kobo FROM {$wpdb->prefix}bsms_pricing WHERE active=1 AND price_kobo>0 ORDER BY id ASC", ARRAY_A);
        // Canonical route names win over old aliases (normal over standard, dnd over premium).
        usort($rows, function($a, $b){
            $r = function($x){ $x = strtolower((string)$x); return in_array($x, array('normal','dnd'), true) ? 0 : 1; };
            return array($r($b['route']), intval($a['id'])) <=> array($r($a['route']), intval($b['id']));
        });
        foreach ($rows as $row) {
            $cc = preg_replace('/\D+/', '', (string)$row['country_code']);
            if ($cc === '') continue; // "INTL" catch-all prices are no longer used
            $fam = in_array(strtolower((string)$row['route']), array('dnd','premium'), true) ? 'dnd' : 'std';
            if ($fam === 'dnd' && $cc !== '234') continue; // Do Not Disturb is Nigerian only
            if (!isset($idx[$cc])) $idx[$cc] = array('std'=>null, 'dnd'=>null, 'entries'=>array());
            $price = intval($row['price_kobo']);
            if ($row['scope'] === 'flat') {
                if (strtolower((string)$row['network']) === 'all' || $row['network'] === '') $idx[$cc][$fam] = $price;
                continue;
            }
            $name = self::network_key($row['network']);
            $prefixes = self::full_prefixes((string)$row['prefixes'], $cc);
            if (!$prefixes && $cc === '234' && $name !== 'all') $prefixes = self::prefixes_for_network($cc, $name);
            if (!$prefixes) continue;
            $key = strtolower($name);
            if (!isset($idx[$cc]['entries'][$key])) $idx[$cc]['entries'][$key] = array('name'=>$name, 'scope'=>$row['scope'], 'prefixes'=>array(), 'std'=>null, 'dnd'=>null);
            $idx[$cc]['entries'][$key]['prefixes'] = array_values(array_unique(array_merge($idx[$cc]['entries'][$key]['prefixes'], $prefixes)));
            $idx[$cc]['entries'][$key][$fam] = $price;
        }
        foreach ($idx as $cc => $c) $idx[$cc]['entries'] = array_values($c['entries']);
        return self::$index = $idx;
    }

    /**
     * v3.6.2 pricing rule (owner decision): the price of a number comes from
     * the price list. The longest matching prefix wins (a single prefix price,
     * then the network's price); otherwise the country's price. No quantity
     * bands. A country without a price is not sent and not charged. Do Not
     * Disturb sends use Do Not Disturb prices only.
     * Returns ['price'=>kobo|null, 'country', 'network', 'reason'].
     */
    public static function quote_number($e164, $route='normal'){
        $digits = preg_replace('/\D+/', '', (string)$e164);
        $country = self::country_code_from_phone($digits);
        $out = array('price'=>null, 'country'=>$country, 'network'=>'', 'reason'=>'', 'special'=>'');
        $idx = self::index();
        if ($country === 'INTL' || !isset($idx[$country])) { $out['reason'] = 'no_country_price'; return $out; }
        $fam = ($country === '234' && self::route($route) === 'dnd') ? 'dnd' : 'std';
        $best = null;
        foreach ($idx[$country]['entries'] as $e) {
            if (empty($e[$fam])) continue;
            foreach ($e['prefixes'] as $p) {
                if (strpos($digits, $p) !== 0) continue;
                $cand = array(strlen($p), -count($e['prefixes']));
                if ($best === null || $cand > $best['rank']) $best = array('rank'=>$cand, 'e'=>$e);
            }
        }
        if ($best) {
            $out['price'] = intval($best['e'][$fam]);
            $out['network'] = $best['e']['scope'] === 'network' ? $best['e']['name'] : '';
            if ($best['e']['scope'] === 'prefix') { $p = $best['e']['prefixes'][0]; $out['special'] = $country === '234' ? '0' . substr($p, 3) : '+' . $country . ' ' . substr($p, strlen($country)); }
        } elseif (!empty($idx[$country][$fam])) {
            $out['price'] = intval($idx[$country][$fam]);
        } else {
            $out['reason'] = $fam === 'dnd' ? 'no_dnd_price' : 'no_country_price';
        }
        if ($out['network'] === '' && $country === '234') { $n = self::detect_network_ng($digits); $out['network'] = $n === 'all' ? '' : $n; }
        return $out;
    }

    /** An SMS service can carry messages to numbers outside Nigeria. */
    public static function international_service_ready(){
        $id = class_exists('BSMS_Providers') ? BSMS_Providers::service_for_route('international') : 0;
        $ready = false;
        if ($id > 0 && class_exists('BSMS_Providers') && method_exists('BSMS_Providers', 'api_by_id')) {
            $api = BSMS_Providers::api_by_id($id);
            $ready = $api && (!isset($api->is_active) || intval($api->is_active) === 1);
        }
        return (bool)apply_filters('bsms_international_service_ready', $ready);
    }

    public static function reason_text($reason){
        switch ($reason) {
            case 'no_service': return __('Sending to this country is not available yet, so this number was not sent or charged.', 'bulk-sms-portal');
            case 'no_dnd_price': return __('Reaching Do Not Disturb numbers is not available, so this number was not sent or charged.', 'bulk-sms-portal');
            default: return __('No price is set for this country, so this number was not sent or charged.', 'bulk-sms-portal');
        }
    }

    public static function country_names(){
        return array('234'=>__('Nigeria', 'bulk-sms-portal'),'229'=>__('Benin', 'bulk-sms-portal'),'233'=>__('Ghana', 'bulk-sms-portal'),'228'=>__('Togo', 'bulk-sms-portal'),'227'=>__('Niger', 'bulk-sms-portal'),'237'=>__('Cameroon', 'bulk-sms-portal'),'235'=>__('Chad', 'bulk-sms-portal'),'225'=>__('Côte d’Ivoire', 'bulk-sms-portal'),'221'=>__('Senegal', 'bulk-sms-portal'),'220'=>__('Gambia', 'bulk-sms-portal'),'231'=>__('Liberia', 'bulk-sms-portal'),'232'=>__('Sierra Leone', 'bulk-sms-portal'),'224'=>__('Guinea', 'bulk-sms-portal'),'223'=>__('Mali', 'bulk-sms-portal'),'226'=>__('Burkina Faso', 'bulk-sms-portal'),'254'=>__('Kenya', 'bulk-sms-portal'),'255'=>__('Tanzania', 'bulk-sms-portal'),'256'=>__('Uganda', 'bulk-sms-portal'),'250'=>__('Rwanda', 'bulk-sms-portal'),'251'=>__('Ethiopia', 'bulk-sms-portal'),'27'=>__('South Africa', 'bulk-sms-portal'),'20'=>__('Egypt', 'bulk-sms-portal'),'212'=>__('Morocco', 'bulk-sms-portal'),'44'=>__('United Kingdom', 'bulk-sms-portal'),'1'=>__('United States and Canada', 'bulk-sms-portal'),'353'=>__('Ireland', 'bulk-sms-portal'),'49'=>__('Germany', 'bulk-sms-portal'),'33'=>__('France', 'bulk-sms-portal'),'39'=>__('Italy', 'bulk-sms-portal'),'34'=>__('Spain', 'bulk-sms-portal'),'31'=>__('Netherlands', 'bulk-sms-portal'),'971'=>__('United Arab Emirates', 'bulk-sms-portal'),'966'=>__('Saudi Arabia', 'bulk-sms-portal'),'974'=>__('Qatar', 'bulk-sms-portal'),'91'=>__('India', 'bulk-sms-portal'),'86'=>__('China', 'bulk-sms-portal'),'61'=>__('Australia', 'bulk-sms-portal'),'260'=>__('Zambia', 'bulk-sms-portal'),'263'=>__('Zimbabwe', 'bulk-sms-portal'),'244'=>__('Angola', 'bulk-sms-portal'),'241'=>__('Gabon', 'bulk-sms-portal'),'240'=>__('Equatorial Guinea', 'bulk-sms-portal'),'236'=>__('Central African Republic', 'bulk-sms-portal'),'243'=>__('DR Congo', 'bulk-sms-portal'),'242'=>__('Congo', 'bulk-sms-portal'));
    }
    public static function country_name($code){
        $code = preg_replace('/\D+/', '', (string)$code);
        $names = self::country_names();
        return $names[$code] ?? ('+' . $code);
    }

    public static function detect_network_ng($e164){
        $digits = preg_replace('/\D+/', '', (string)$e164);
        if (strpos($digits, '234') !== 0) return 'all';
        $local = substr($digits, 3);
        if (strlen($local) < 3) return 'all';
        $prefix = substr($local, 0, 3);

        if (self::$network_map === null) {
            global $wpdb;
            $t = BSMS_DB::table('prefix_network');
            self::$network_map = array();
            foreach ((array)$wpdb->get_results($wpdb->prepare("SELECT prefix, network FROM {$wpdb->prefix}bsms_prefix_network WHERE country_code=%s AND active=1 ORDER BY id ASC", '234'), ARRAY_A) as $row) {
                if (!isset(self::$network_map[$row['prefix']])) self::$network_map[$row['prefix']] = $row['network'];
            }
        }
        $network = self::$network_map[$prefix] ?? '';
        return $network ?: 'all';
    }

    public static function route_candidates($route){
        $route = self::route($route);
        $candidates = array($route);
        if ($route === 'dnd') $candidates[] = 'premium'; // legacy compatibility only
        if ($route === 'normal') $candidates[] = 'standard';
        $candidates[] = 'normal';
        $candidates[] = 'standard';
        return array_values(array_unique(array_filter($candidates)));
    }



    public static function purge_public_pricing_cache(){
        self::flush_cache();
        if (function_exists('wp_cache_flush')) wp_cache_flush();
        if (function_exists('rocket_clean_domain')) rocket_clean_domain();
        if (function_exists('w3tc_flush_all')) w3tc_flush_all();
        if (function_exists('wpfc_clear_all_cache')) wpfc_clear_all_cache(true);
        do_action('bsms_pricing_changed');
    }

    public static function has_configured_route_rate($route='normal'){
        global $wpdb;
        self::ensure_pricing_band_columns();
        $route = self::route($route);
        $t = BSMS_DB::table('pricing');
        $routes = self::route_candidates($route);
        $count = intval($wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->prefix}bsms_pricing WHERE active=1 AND price_kobo>0 AND route IN (" . implode(',', array_fill(0, count($routes), '%s')) . ")",
            $routes
        )));
        return $count > 0;
    }

    /** Price of one SMS page to this number, or null when it cannot be sent. Quantity is ignored (v3.6.2). */
    public static function unit_price_kobo($e164, $route='standard', $quantity=1){
        $q = self::quote_number($e164, $route);
        return $q['price'] === null ? null : intval($q['price']);
    }

    public static function price_breakdown($numbers, $message, $route='standard', $user_id=0){
        $pages = max(1, BSMS_Util::sms_pages($message));
        $rows = array();
        $total = 0;
        $intl_ready = null;
        foreach ((array)$numbers as $phone) {
            $q = self::quote_number($phone, $route);
            $country = $q['country'];
            $effective_route = ($country !== '234') ? 'international' : self::route($route);
            $reason = $q['reason'];
            if ($q['price'] !== null && $country !== '234') {
                if ($intl_ready === null) $intl_ready = self::international_service_ready();
                if (!$intl_ready) $reason = 'no_service';
            }
            if ($q['price'] === null || $reason === 'no_service') {
                $rows[] = array('phone'=>$phone, 'country'=>$country, 'network'=>$q['network'] ?: 'all', 'route'=>$effective_route, 'pages'=>$pages,
                    'unit_price_kobo'=>0, 'cost_kobo'=>0, 'no_rate'=>true, 'reason'=>$reason ?: 'no_country_price',
                    'pricing_note'=>self::reason_text($reason));
                continue;
            }
            $unit = self::customer_price_kobo($q['price'], $user_id);
            $cost = $unit * $pages;
            $total += $cost;
            $rows[] = array(
                'phone'=>$phone,
                'country'=>$country,
                'network'=>$q['network'] ?: 'all',
                'special'=>$q['special'],
                'route'=>$effective_route,
                'pages'=>$pages,
                'unit_price_kobo'=>$unit,
                'cost_kobo'=>$cost,
                'pricing_note'=>__('Price for this number from the price list.', 'bulk-sms-portal'),
            );
        }
        $no_rate = array(); $reasons = array();
        foreach ($rows as $r) { if (!empty($r['no_rate'])) { $no_rate[] = $r['phone']; $reasons[$r['phone']] = $r['reason']; } }
        $priced = count((array)$numbers) - count($no_rate);
        return array(
            'pages'=>$pages,
            'recipients'=>$priced,
            'units'=>$priced * $pages,
            'total_kobo'=>$total,
            'rows'=>$rows,
            'no_rate'=>$no_rate,
            'no_rate_reasons'=>$reasons,
        );
    }


    public static function ensure_pricing_prefix_column(){
        if (!empty(self::$schema_checked['ensure_pricing_prefix_column'])) return;
        self::$schema_checked['ensure_pricing_prefix_column'] = true;
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        $exists = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM {$wpdb->prefix}bsms_pricing LIKE %s", 'prefixes'));
        if (!$exists) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_pricing ADD prefixes LONGTEXT NULL AFTER price_kobo");
        }
    }


    public static function ensure_pricing_band_columns(){
        if (!empty(self::$schema_checked['ensure_pricing_band_columns'])) return;
        self::$schema_checked['ensure_pricing_band_columns'] = true;
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        $cols = $wpdb->get_col("DESC {$wpdb->prefix}bsms_pricing", 0);
        if (!is_array($cols)) $cols = array();
        if (!in_array('min_qty', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_pricing ADD min_qty BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER route");
        }
        if (!in_array('max_qty', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_pricing ADD max_qty BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER min_qty");
        }
    }

    public static function quantity_band_label($min_qty, $max_qty=0){
        // v3.6.2: prices no longer depend on the size of a send.
        return __('Any size', 'bulk-sms-portal');
    }

    /** The country's own price (quantity is ignored from v3.6.2). */
    public static function flat_rate_for_quantity_kobo($route='normal', $quantity=1, $country_code='234'){
        $cc = preg_replace('/\D+/', '', (string)$country_code) ?: '234';
        $idx = self::index();
        $fam = ($cc === '234' && self::route($route) === 'dnd') ? 'dnd' : 'std';
        return isset($idx[$cc][$fam]) && $idx[$cc][$fam] ? intval($idx[$cc][$fam]) : null;
    }

    /**
     * The highest standard price of one SMS page to a Nigerian number (the
     * country price or any network price). "About N SMS" estimates divide by
     * this, so they are never more than a customer can actually send.
     */
    public static function typical_nigeria_kobo($route='normal'){
        $idx = self::index();
        if (!isset($idx['234'])) return 0;
        $fam = self::route($route) === 'dnd' ? 'dnd' : 'std';
        $max = intval($idx['234'][$fam] ?? 0);
        foreach ($idx['234']['entries'] as $e) { if (!empty($e[$fam])) $max = max($max, intval($e[$fam])); }
        return $max;
    }

    public static function estimated_units_for_amount($amount_kobo, $route='normal', $country_code='234'){
        $amount_kobo = max(0, intval($amount_kobo));
        if ($amount_kobo <= 0) return 0;
        $price = self::typical_nigeria_kobo($route);
        if ($price <= 0) $price = max(1, self::base_unit_kobo());
        return intdiv($amount_kobo, $price);
    }




    public static function normalise_prefixes($raw, $country_code='234'){
        $country_code = preg_replace('/\D+/', '', (string)$country_code);
        if ($country_code === '') $country_code = '234';
        $tokens = preg_split('/[\s,;|]+/', (string)$raw, -1, PREG_SPLIT_NO_EMPTY);
        $out = array();
        foreach ($tokens as $token) {
            $digits = preg_replace('/\D+/', '', (string)$token);
            if ($digits === '') continue;
            if (strpos($digits, '00' . $country_code) === 0) {
                $digits = substr($digits, 2 + strlen($country_code));
            } elseif (strpos($digits, $country_code) === 0) {
                $digits = substr($digits, strlen($country_code));
            } elseif (strpos($digits, '0') === 0 && strlen($digits) > 3) {
                $digits = substr($digits, 1);
            }
            // For Nigerian MSISDNs the routing prefix is the first 3 local digits.
            if ($country_code === '234' && strlen($digits) >= 3) {
                $digits = substr($digits, 0, 3);
            }
            if ($digits !== '' && strlen($digits) <= 8) {
                $out[$digits] = $digits;
            }
        }
        return array_values($out);
    }

    public static function ensure_prefix_table(){
        global $wpdb;
        $t = BSMS_DB::table('prefix_network');
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t));
        if ($exists !== $t && method_exists('BSMS_DB', 'activate')) {
            BSMS_DB::activate();
        }
    }

    public static function prefixes_by_network($country_code='234'){
        global $wpdb;
        self::ensure_prefix_table();
        $country_code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$country_code));
        if ($country_code === '') $country_code = '234';
        $t = BSMS_DB::table('prefix_network');
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT network, prefix FROM {$wpdb->prefix}bsms_prefix_network WHERE country_code=%s AND active=1 ORDER BY network ASC, prefix ASC",
            $country_code
        ), ARRAY_A);
        $map = array();
        foreach ((array)$rows as $row) {
            $network = self::network_key($row['network'] ?: 'all');
            if (!isset($map[$network])) $map[$network] = array();
            $display = $country_code . preg_replace('/\D+/', '', (string)$row['prefix']);
            if ($display !== $country_code && !in_array($display, $map[$network], true)) $map[$network][] = $display;
        }
        return $map;
    }

    public static function prefixes_for_network($country_code, $network){
        global $wpdb;
        self::ensure_prefix_table();
        $country_code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$country_code));
        if ($country_code === '') $country_code = '234';
        $network = self::network_key($network ?: 'all');
        if ($network === 'all') return array();
        $t = BSMS_DB::table('prefix_network');
        $rows = $wpdb->get_col($wpdb->prepare(
            "SELECT prefix FROM {$wpdb->prefix}bsms_prefix_network WHERE country_code=%s AND active=1 AND LOWER(TRIM(network))=LOWER(TRIM(%s)) ORDER BY prefix ASC",
            $country_code, $network
        ));
        $out = array();
        foreach ((array)$rows as $prefix) {
            $display = $country_code . preg_replace('/\D+/', '', (string)$prefix);
            if ($display !== $country_code && !in_array($display, $out, true)) $out[] = $display;
        }
        return $out;
    }


    public static function replace_network_prefixes($country_code, $network, $raw_prefixes){
        global $wpdb;
        $country_code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string)$country_code));
        if ($country_code === '') $country_code = '234';
        $network = self::network_key($network ?: 'all');
        if ($network === 'all') return 0;
        $prefixes = self::normalise_prefixes($raw_prefixes, $country_code);
        self::ensure_prefix_table();
        $t = BSMS_DB::table('prefix_network');

        // Treat the textarea as the authoritative list for this network/country.
        // This prevents removed prefixes from silently remaining mapped in the backend.
        $wpdb->update($t, array('active'=>0), array('country_code'=>$country_code, 'network'=>$network));

        if (empty($prefixes)) return 0;
        $changed = 0;
        foreach ($prefixes as $prefix) {
            // A prefix can only belong to one network per country. Reassign if needed.
            $exists = $wpdb->get_var($wpdb->prepare(
                "SELECT id FROM {$wpdb->prefix}bsms_prefix_network WHERE country_code=%s AND prefix=%s LIMIT 1",
                $country_code, $prefix
            ));
            $data = array('network'=>$network, 'active'=>1);
            if ($exists) {
                $wpdb->update($t, $data, array('id'=>intval($exists)));
            } else {
                $wpdb->insert($t, array(
                    'country_code'=>$country_code,
                    'prefix'=>$prefix,
                    'network'=>$network,
                    'active'=>1
                ));
            }
            $changed++;
        }
        return $changed;
    }


    public static function seed_ng_prefixes(){
        global $wpdb;
        $t = BSMS_DB::table('prefix_network');

        $map = array(
            'MTN'=>array('803','806','813','814','816','903','906','913','916','703','706','704'),
            'Airtel'=>array('802','808','812','701','708','902','901','904','907','912'),
            'Glo'=>array('805','807','811','705','815','905','915'),
            '9mobile'=>array('809','817','818','908','909'),
            'NTel'=>array('804')
        );

        $now = BSMS_Util::now_gmt();
        $inserted = 0;
        foreach ($map as $network=>$prefixes) {
            foreach ($prefixes as $prefix) {
                $exists = $wpdb->get_var($wpdb->prepare("SELECT id FROM {$wpdb->prefix}bsms_prefix_network WHERE country_code=%s AND prefix=%s", '234', $prefix));
                if (!$exists) {
                    $wpdb->insert($t, array(
                        'country_code'=>'234',
                        'prefix'=>$prefix,
                        'network'=>$network,
                        'active'=>1
                    ));
                    $inserted++;
                }
            }
        }
        return $inserted;
    }

    public static function seed_default_rates(){
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        $base = max(1, intval(get_option('bsms_base_unit_price_kobo', 1000)));
        $now = BSMS_Util::now_gmt();
        // v3.6.2: one price for Nigeria (and one for Do Not Disturb numbers).
        // Other countries are not priced until the admin adds them.
        $has = intval($wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_pricing WHERE country_code='234' AND scope='flat'"));
        if ($has) return 0;
        $wpdb->insert($t, array('title'=>__('Nigeria', 'bulk-sms-portal'),'country_code'=>'234','scope'=>'flat','network'=>'all','route'=>'normal','min_qty'=>1,'max_qty'=>0,'price_kobo'=>$base,'active'=>1,'updated_at'=>$now));
        $wpdb->insert($t, array('title'=>__('Nigeria (Do Not Disturb)', 'bulk-sms-portal'),'country_code'=>'234','scope'=>'flat','network'=>'all','route'=>'dnd','min_qty'=>1,'max_qty'=>0,'price_kobo'=>intval(round($base*1.5)),'active'=>1,'updated_at'=>$now));
        self::flush_cache();
        return 2;
    }

    /* ------------------------------------------------------------------
     * v3.6.2 price list: read and save as one list, and the one-time move
     * from quantity bands.
     * ------------------------------------------------------------------ */

    /** The whole price list, grouped by country, for Pricing Manager and the Pricing page. */
    public static function price_list($user_id = 0){
        $idx = self::index();
        $adj = function($k) use ($user_id){ return $k ? ($user_id ? self::customer_price_kobo($k, $user_id) : intval($k)) : null; };
        $codes = array_map('strval', array_keys($idx));
        if (!in_array('234', $codes, true)) array_unshift($codes, '234');
        usort($codes, function($a, $b){ if ($a === '234') return -1; if ($b === '234') return 1; return strcmp(self::country_name($a), self::country_name($b)); });
        $out = array();
        foreach ($codes as $cc) {
            $cc = (string)$cc;
            $c = $idx[$cc] ?? array('std'=>null, 'dnd'=>null, 'entries'=>array());
            $networks = array(); $prefixes = array();
            foreach ($c['entries'] as $e) {
                $item = array('name'=>$e['name'], 'prefixes'=>$e['prefixes'], 'standard_kobo'=>$adj($e['std']), 'dnd_kobo'=>$cc === '234' ? $adj($e['dnd']) : null);
                if ($e['scope'] === 'prefix') $prefixes[] = $item; else $networks[] = $item;
            }
            usort($networks, function($a, $b){ return strcasecmp($a['name'], $b['name']); });
            $out[] = array('code'=>$cc, 'name'=>self::country_name($cc), 'standard_kobo'=>$adj($c['std']), 'dnd_kobo'=>$cc === '234' ? $adj($c['dnd']) : null, 'networks'=>$networks, 'prefixes'=>$prefixes);
        }
        return $out;
    }

    /**
     * Replace the whole price list. $countries is the list from Pricing
     * Manager: [{code, standard_naira, dnd_naira, networks:[{name, prefixes,
     * standard_naira, dnd_naira}], prefixes:[{prefix, standard_naira, dnd_naira}]}].
     * Returns true or a WP_Error with a plain message.
     */
    public static function save_price_list($countries){
        global $wpdb;
        if (!is_array($countries)) return new WP_Error('bad', __('Nothing to save.', 'bulk-sms-portal'));
        $t = BSMS_DB::table('pricing');
        $now = BSMS_Util::now_gmt();
        $kobo = function($v){ $v = is_string($v) ? str_replace(array(',', '₦', ' '), '', $v) : $v; return ($v === '' || $v === null) ? 0 : max(0, intval(round(floatval($v) * 100))); };
        $rows = array(); $seen = array(); $ng_networks = array(); $all_prefixes = array();
        foreach ($countries as $c) {
            $cc = preg_replace('/\D+/', '', (string)($c['code'] ?? ''));
            if ($cc === '' || strlen($cc) > 4) return new WP_Error('bad', __('Enter a country code of 1 to 4 numbers, such as 229 for Benin.', 'bulk-sms-portal'));
            if (isset($seen[$cc])) return new WP_Error('bad', sprintf(/* translators: %s: a value filled in when shown */ __('%s is in the list twice.', 'bulk-sms-portal'), self::country_name($cc)));
            $seen[$cc] = true;
            $name = self::country_name($cc);
            $std = $kobo($c['standard_naira'] ?? ''); $dnd = $cc === '234' ? $kobo($c['dnd_naira'] ?? '') : 0;
            if ($cc !== '234' && !$std) return new WP_Error('bad', sprintf(/* translators: %s: a value filled in when shown */ __('Enter a price for %s, or remove it.', 'bulk-sms-portal'), $name));
            if ($std) $rows[] = array('title'=>$name, 'country_code'=>$cc, 'scope'=>'flat', 'network'=>'all', 'route'=>'normal', 'price_kobo'=>$std, 'prefixes'=>'');
            if ($dnd) $rows[] = array('title'=>sprintf(/* translators: %s: a value filled in when shown */ __('%s (Do Not Disturb)', 'bulk-sms-portal'), $name), 'country_code'=>$cc, 'scope'=>'flat', 'network'=>'all', 'route'=>'dnd', 'price_kobo'=>$dnd, 'prefixes'=>'');
            foreach (array('networks'=>'network', 'prefixes'=>'prefix') as $key => $scope) {
                foreach ((array)($c[$key] ?? array()) as $e) {
                    $raw = is_array($e['prefixes'] ?? null) ? implode(',', $e['prefixes']) : (string)($e['prefixes'] ?? ($e['prefix'] ?? ''));
                    $full = self::full_prefixes($raw, $cc);
                    $label = $scope === 'network' ? self::network_key(sanitize_text_field((string)($e['name'] ?? ''))) : ($full[0] ?? '');
                    $estd = $kobo($e['standard_naira'] ?? ''); $ednd = $cc === '234' ? $kobo($e['dnd_naira'] ?? '') : 0;
                    if ($scope === 'network' && ($label === 'all' || $label === '')) return new WP_Error('bad', __('Give every network a name.', 'bulk-sms-portal'));
                    if ($scope === 'network' && strlen($label) > 30) return new WP_Error('bad', sprintf(/* translators: %s: a value filled in when shown */ __('Network names can be up to 30 letters: %s.', 'bulk-sms-portal'), $label));
                    if (!$full) return new WP_Error('bad', sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s in %2$s needs at least one number prefix.', 'bulk-sms-portal'), ($scope === 'network' ? $label : __('A special price', 'bulk-sms-portal')), $name));
                    if (!$estd && !$ednd) return new WP_Error('bad', sprintf(/* translators: %s: a value filled in when shown */ __('Enter a price for %s, or remove it.', 'bulk-sms-portal'), ($scope === 'network' ? $label : implode(', ', $full))));
                    if ($scope === 'prefix' && count($full) > 1) return new WP_Error('bad', __('Add one prefix for each special price.', 'bulk-sms-portal'));
                    foreach ($full as $p) {
                        $k = $scope . '|' . $p;
                        $pl = $cc === '234' ? '0' . substr($p, 3) : '+' . $cc . ' ' . substr($p, strlen($cc));
                        if (isset($all_prefixes[$k])) return new WP_Error('bad', sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s is used twice: in %2$s and in %3$s.', 'bulk-sms-portal'), $pl, $all_prefixes[$k], ($scope === 'network' ? $label : __('a special price', 'bulk-sms-portal'))));
                        $all_prefixes[$k] = $scope === 'network' ? $label : __('a special price', 'bulk-sms-portal');
                    }
                    $pref = implode(', ', $full);
                    if ($estd) $rows[] = array('title'=>$label, 'country_code'=>$cc, 'scope'=>$scope, 'network'=>$label, 'route'=>'normal', 'price_kobo'=>$estd, 'prefixes'=>$pref);
                    if ($ednd) $rows[] = array('title'=>sprintf(/* translators: %s: a value filled in when shown */ __('%s (Do Not Disturb)', 'bulk-sms-portal'), $label), 'country_code'=>$cc, 'scope'=>$scope, 'network'=>$label, 'route'=>'dnd', 'price_kobo'=>$ednd, 'prefixes'=>$pref);
                    if ($cc === '234' && $scope === 'network') $ng_networks[$label] = $pref;
                }
            }
        }
        if (!isset($seen['234'])) return new WP_Error('bad', __('Nigeria must stay in the list.', 'bulk-sms-portal'));
        $has_ng = false; foreach ($rows as $r) if ($r['country_code'] === '234' && $r['route'] === 'normal' && $r['scope'] === 'flat') $has_ng = true;
        if (!$has_ng) return new WP_Error('bad', __('Enter the Nigeria price. It is used for any Nigerian number whose network has no price of its own.', 'bulk-sms-portal'));
        // v3.7.1: write the new list first and only then remove the old one, so
        // a failed write (on any database) never leaves the site without prices.
        $new_ids = array();
        foreach ($rows as $r) {
            $ok = $wpdb->insert($t, $r + array('min_qty'=>1, 'max_qty'=>0, 'active'=>1, 'updated_at'=>$now));
            if ($ok === false) {
                if ($new_ids) $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}bsms_pricing WHERE id IN (" . implode(',', array_fill(0, count($new_ids), '%d')) . ')', $new_ids));
                self::flush_cache();
                return new WP_Error('bad', __('Prices could not be saved, so your old prices are still in use. Please try again.', 'bulk-sms-portal'));
            }
            $new_ids[] = intval($wpdb->insert_id);
        }
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->prefix}bsms_pricing WHERE id NOT IN (" . implode(',', array_fill(0, count($new_ids), '%d')) . ')', $new_ids));
        // Keep Nigeria's prefix-to-network map (used to name the network in reports) in step.
        foreach ($ng_networks as $label => $pref) self::replace_network_prefixes('234', $label, $pref);
        update_option('bsms_base_unit_price_kobo', intval($wpdb->get_var("SELECT price_kobo FROM {$wpdb->prefix}bsms_pricing WHERE country_code='234' AND scope='flat' AND route='normal' LIMIT 1")), false);
        self::flush_cache();
        self::purge_public_pricing_cache();
        return true;
    }

    /**
     * One-time move to the v3.6.2 rule. For each country/network/delivery it
     * keeps the price that applied to the smallest send (so nobody pays less
     * than before for small sends), drops the other quantity bands, drops the
     * "every other country" price, and records what changed for the admin.
     */
    public static function unify_price_list(){
        if (get_option('bsms_price_list_unified')) return array();
        global $wpdb;
        $t = BSMS_DB::table('pricing');
        if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $t)) !== $t) return array();
        self::ensure_pricing_prefix_column();
        self::ensure_pricing_band_columns();
        $rows = (array)$wpdb->get_results("SELECT * FROM {$wpdb->prefix}bsms_pricing WHERE active=1 ORDER BY id ASC", ARRAY_A);
        $notes = array();
        $groups = array();
        foreach ($rows as $r) {
            $cc = strtoupper((string)$r['country_code']);
            if ($cc === 'INTL' || preg_replace('/\D+/', '', $cc) === '') {
                $wpdb->update($t, array('active'=>0), array('id'=>intval($r['id'])));
                $notes[] = sprintf(/* translators: %s: a value filled in when shown */ __('The price for "every other country" (%s) is no longer used. Numbers in a country without its own price are not sent or charged.', 'bulk-sms-portal'), BSMS_Util::money(intval($r['price_kobo'])));
                continue;
            }
            $fam = in_array(strtolower((string)$r['route']), array('dnd','premium'), true) ? 'dnd' : 'normal';
            $groups[$cc . '|' . $r['scope'] . '|' . strtolower((string)$r['network']) . '|' . $fam][] = $r;
        }
        foreach ($groups as $key => $list) {
            list($cc, $scope, , $fam) = explode('|', $key);
            usort($list, function($a, $b){
                $ra = in_array(strtolower($a['route']), array('normal','dnd'), true) ? 0 : 1;
                $rb = in_array(strtolower($b['route']), array('normal','dnd'), true) ? 0 : 1;
                return array($ra, intval($a['min_qty']), intval($a['id'])) <=> array($rb, intval($b['min_qty']), intval($b['id']));
            });
            $keep = array_shift($list);
            $wpdb->update($t, array('route'=>$fam, 'min_qty'=>1, 'max_qty'=>0), array('id'=>intval($keep['id'])));
            $dropped = array();
            foreach ($list as $x) { $wpdb->update($t, array('active'=>0), array('id'=>intval($x['id']))); if (intval($x['min_qty']) > intval($keep['min_qty']) && intval($x['price_kobo']) !== intval($keep['price_kobo'])) $dropped[] = BSMS_Util::money(intval($x['price_kobo'])); }
            if ($dropped) {
                $what = $scope === 'flat' ? self::country_name($cc) : $keep['network'] . ' (' . self::country_name($cc) . ')';
                $notes[] = sprintf(/* translators: %1$s, %2$s, %3$s, %4$s: values filled in when shown */ __('%1$s%2$s: now %3$s for every send. Prices for bigger sends (%4$s) were removed.', 'bulk-sms-portal'), $what, ($fam === 'dnd' ? __(', Do Not Disturb', 'bulk-sms-portal') : ''), BSMS_Util::money(intval($keep['price_kobo'])), implode(', ', array_unique($dropped)));
            }
        }
        update_option('bsms_price_list_unified', BSMS_Util::now_gmt(), false);
        if ($notes) update_option('bsms_price_list_notes', array_values(array_unique($notes)), false);
        self::flush_cache();
        return $notes;
    }
}
