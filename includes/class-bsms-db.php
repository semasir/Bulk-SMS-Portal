<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

class BSMS_DB {
    public static function init(){
        $installed = get_option('bsms_pro_db_version', '');
        if ($installed !== BSMS_PRO_VERSION) {
            try {
                self::activate();
                update_option('bsms_pro_db_version', BSMS_PRO_VERSION);
            } catch (Throwable $e) {
                update_option('bsms_last_db_error', $e->getMessage());
                if (defined('WP_DEBUG') && WP_DEBUG) error_log('Bulk SMS Portal DB init error: ' . $e->getMessage()); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
            }
        }
    }

    public static function table($name){ return BSMS_Util::table($name); }

    public static function activate(){
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $charset = $wpdb->get_charset_collate();

        $sql = array();

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_wallets (
            user_id BIGINT UNSIGNED NOT NULL,
            balance_kobo BIGINT NOT NULL DEFAULT 0,
            universal_balance_kobo BIGINT NOT NULL DEFAULT 0,
            sms_balance_kobo BIGINT NOT NULL DEFAULT 0,
            bonus_balance_kobo BIGINT NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (user_id)
        ) ENGINE=InnoDB $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_ledger (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            type VARCHAR(40) NOT NULL,
            channel VARCHAR(40) NOT NULL DEFAULT 'system',
            amount_kobo BIGINT NOT NULL,
            wallet VARCHAR(20) NOT NULL DEFAULT 'sms',
            currency VARCHAR(8) NOT NULL DEFAULT 'NGN',
            status VARCHAR(20) NOT NULL DEFAULT 'success',
            reference VARCHAR(100) NOT NULL,
            provider VARCHAR(40) NOT NULL DEFAULT 'system',
            comments TEXT NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY ref (reference),
            KEY user_id (user_id),
            KEY type (type),
            KEY wallet (wallet)
        ) ENGINE=InnoDB $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_apis (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(120) NOT NULL,
            send_url TEXT NOT NULL,
            balance_url TEXT NULL,
            api_username VARCHAR(255) NULL,
            api_password TEXT NULL,
            method VARCHAR(8) NOT NULL DEFAULT 'POST',
            auth_headers LONGTEXT NULL,
            success_pattern VARCHAR(255) NULL,
            failure_pattern VARCHAR(255) NULL,
            balance_pattern VARCHAR(255) NULL,
            payload_template LONGTEXT NULL,
            request_format VARCHAR(20) NOT NULL DEFAULT 'json',
            extra_query LONGTEXT NULL,
            dlr_url TEXT NULL,
            dlr_lookup_url TEXT NULL,
            dlr_status_pattern VARCHAR(255) NULL,
            dlr_success_codes TEXT NULL,
            dlr_failure_codes TEXT NULL,
            message_id_pattern VARCHAR(255) NULL,
            provider_preset VARCHAR(80) NOT NULL DEFAULT 'generic_get',
            error_code_map LONGTEXT NULL,
            code_pattern VARCHAR(255) NULL,
            message_id_json_path VARCHAR(255) NULL,
            status_json_path VARCHAR(255) NULL,
            is_active TINYINT(1) NOT NULL DEFAULT 0,
            assigned_route VARCHAR(30) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY is_active (is_active)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_sender_ids (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            sender_id VARCHAR(32) NOT NULL,
            sample_message TEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            admin_note TEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_contacts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            phone_e164 VARCHAR(32) NOT NULL,
            raw_phone VARCHAR(64) NULL,
            name VARCHAR(120) NULL,
            list_name VARCHAR(120) NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY user_phone (user_id, phone_e164),
            KEY user_id (user_id),
            KEY list_name (list_name)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_phone_groups (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            group_name VARCHAR(160) NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_phone_group_numbers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            group_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            phone_e164 VARCHAR(32) NOT NULL,
            raw_phone VARCHAR(64) NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY group_phone (group_id, phone_e164),
            KEY user_id (user_id)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_templates (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            title VARCHAR(160) NOT NULL,
            category VARCHAR(40) NOT NULL DEFAULT 'custom',
            body LONGTEXT NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY category (category)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_campaigns (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            name VARCHAR(160) NOT NULL,
            message LONGTEXT NOT NULL,
            sender_id VARCHAR(32) NULL,
            route VARCHAR(20) NOT NULL DEFAULT 'standard',
            dedupe_mode VARCHAR(20) NOT NULL DEFAULT 'campaign',
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            schedule_at DATETIME NULL,
            recipients_count INT NOT NULL DEFAULT 0,
            pages INT NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY status (status),
            KEY schedule_at (schedule_at)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_jobs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id BIGINT UNSIGNED NOT NULL,
            user_id BIGINT UNSIGNED NOT NULL,
            to_phone_e164 VARCHAR(32) NULL,
            recipient VARCHAR(32) NULL,
            body LONGTEXT NULL,
            message LONGTEXT NULL,
            sender_id VARCHAR(32) NULL,
            route VARCHAR(20) NOT NULL DEFAULT 'standard',
            provider VARCHAR(64) NOT NULL DEFAULT '',
            api_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            provider_message_id VARCHAR(128) NULL,
            provider_status VARCHAR(80) NULL,
            network VARCHAR(40) NULL,
            last_synced_at DATETIME NULL,
            sync_notes TEXT NULL,
            status_bucket VARCHAR(20) NOT NULL DEFAULT 'queued',
            err_code VARCHAR(64) NULL,
            attempts INT NOT NULL DEFAULT 0,
            last_error TEXT NULL,
            unit_price_kobo BIGINT NOT NULL DEFAULT 0,
            cost_kobo BIGINT NOT NULL DEFAULT 0,
            sent_at DATETIME NULL,
            delivered_at DATETIME NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY campaign_id (campaign_id),
            KEY user_status (user_id, status_bucket),
            KEY provider_message_id (provider_message_id),
            KEY api_id (api_id)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_paystack_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            reference VARCHAR(100) NOT NULL,
            event_type VARCHAR(64) NULL,
            status VARCHAR(32) NULL,
            raw_payload LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY ref (reference)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_funding_requests (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            amount_kobo BIGINT NOT NULL DEFAULT 0,
            method VARCHAR(40) NOT NULL DEFAULT 'manual',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            reference VARCHAR(100) NOT NULL,
            depositor_name VARCHAR(190) NULL,
            bank_name VARCHAR(190) NULL,
            proof_url TEXT NULL,
            proof_attachment_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            admin_note TEXT NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY ref (reference),
            KEY user_status (user_id, status),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_pricing (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(160) NULL,
            country_code VARCHAR(8) NOT NULL,
            scope VARCHAR(20) NOT NULL DEFAULT 'flat',
            network VARCHAR(40) NOT NULL DEFAULT 'all',
            route VARCHAR(20) NOT NULL DEFAULT 'standard',
            min_qty BIGINT UNSIGNED NOT NULL DEFAULT 1,
            max_qty BIGINT UNSIGNED NOT NULL DEFAULT 0,
            price_kobo BIGINT NOT NULL DEFAULT 0,
            prefixes LONGTEXT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            notes TEXT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY country_scope (country_code, scope),
            KEY route (route),
            KEY active (active)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_prefix_network (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            country_code VARCHAR(8) NOT NULL,
            prefix VARCHAR(8) NOT NULL,
            network VARCHAR(20) NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            UNIQUE KEY cc_prefix (country_code, prefix)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_admin_messages (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(190) NOT NULL,
            message LONGTEXT NOT NULL,
            send_email TINYINT(1) NOT NULL DEFAULT 1,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_api_keys (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            key_name VARCHAR(160) NOT NULL DEFAULT 'Default API Key',
            api_username VARCHAR(120) NULL,
            api_password_hash VARCHAR(255) NULL,
            key_prefix VARCHAR(24) NOT NULL,
            key_hash VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            allowed_ips TEXT NULL,
            daily_limit INT NOT NULL DEFAULT 1000,
            last_used_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY key_prefix (key_prefix),
            UNIQUE KEY api_username (api_username),
            KEY user_id (user_id),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_api_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            api_key_id BIGINT UNSIGNED NULL,
            endpoint VARCHAR(120) NOT NULL,
            method VARCHAR(12) NOT NULL,
            ip_address VARCHAR(64) NULL,
            status_code INT NOT NULL DEFAULT 200,
            success TINYINT(1) NOT NULL DEFAULT 0,
            message TEXT NULL,
            request_json LONGTEXT NULL,
            response_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY api_key_id (api_key_id),
            KEY endpoint (endpoint),
            KEY created_at (created_at)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_notifications (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL,
            type VARCHAR(60) NOT NULL,
            channel VARCHAR(20) NOT NULL DEFAULT 'email',
            subject VARCHAR(190) NULL,
            message TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            cost_kobo BIGINT NOT NULL DEFAULT 0,
            reference VARCHAR(100) NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            sent_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY type (type),
            KEY channel (channel),
            KEY status (status)
        ) $charset;";


        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_activity_logs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            action VARCHAR(80) NOT NULL,
            object_type VARCHAR(80) NOT NULL DEFAULT '',
            object_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            ip_address VARCHAR(64) NULL,
            message TEXT NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY actor_id (actor_id),
            KEY action (action),
            KEY object_type (object_type),
            KEY created_at (created_at)
        ) $charset;";


        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_queue (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            job_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            route VARCHAR(20) NOT NULL DEFAULT 'normal',
            payload_json LONGTEXT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            attempts INT NOT NULL DEFAULT 0,
            next_run_at DATETIME NULL,
            locked_at DATETIME NULL,
            last_error TEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY status_next (status, next_run_at),
            KEY campaign_id (campaign_id),
            KEY user_id (user_id)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_dlr_events (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            job_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            provider_message_id VARCHAR(128) NULL,
            provider VARCHAR(80) NULL,
            delivery_status VARCHAR(40) NOT NULL DEFAULT 'unknown',
            raw_payload LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY provider_message_id (provider_message_id),
            KEY campaign_id (campaign_id),
            KEY job_id (job_id),
            KEY delivery_status (delivery_status)
        ) $charset;";


        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_provider_health (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            api_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            route VARCHAR(40) NOT NULL DEFAULT 'normal',
            status VARCHAR(20) NOT NULL DEFAULT 'unknown',
            success_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            fail_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            last_success_at DATETIME NULL,
            last_failure_at DATETIME NULL,
            last_error TEXT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY api_route (api_id, route),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_api_usage (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            api_username VARCHAR(120) NULL,
            endpoint VARCHAR(80) NOT NULL DEFAULT '',
            route VARCHAR(40) NOT NULL DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT '',
            units INT NOT NULL DEFAULT 0,
            cost_kobo BIGINT NOT NULL DEFAULT 0,
            ip_address VARCHAR(64) NULL,
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY api_username (api_username),
            KEY endpoint (endpoint),
            KEY route (route),
            KEY status (status),
            KEY created_at (created_at)
        ) $charset;";


        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_resellers (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            brand_name VARCHAR(160) NULL,
            domain VARCHAR(190) NULL,
            commission_percent DECIMAL(10,2) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            meta_json LONGTEXT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY user_id (user_id),
            KEY status (status)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_subscriptions (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            reseller_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            plan_name VARCHAR(160) NOT NULL,
            billing_cycle VARCHAR(40) NOT NULL DEFAULT 'monthly',
            amount_kobo BIGINT NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
            sms_units INT NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            starts_at DATETIME NULL,
            renews_at DATETIME NULL,
            ends_at DATETIME NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY reseller_id (reseller_id),
            KEY status (status),
            KEY renews_at (renews_at)
        ) $charset;";

        $sql[] = "CREATE TABLE {$wpdb->prefix}bsms_currency_rates (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            currency VARCHAR(10) NOT NULL,
            rate_to_base DECIMAL(18,8) NOT NULL DEFAULT 1,
            base_currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
            updated_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY currency_base (currency, base_currency)
        ) $charset;";

        
$sql[] = "CREATE TABLE {$wpdb->prefix}bsms_dead_letters (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
source_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
reason TEXT NULL,
payload_json LONGTEXT NULL,
created_at DATETIME NOT NULL,
PRIMARY KEY (id)
) $charset;";

$sql[] = "CREATE TABLE {$wpdb->prefix}bsms_suppression_list (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
phone VARCHAR(40) NOT NULL,
created_at DATETIME NOT NULL,
PRIMARY KEY (id)
) $charset;";

$sql[] = "CREATE TABLE {$wpdb->prefix}bsms_url_clicks (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
short_code VARCHAR(40) NOT NULL,
original_url TEXT NOT NULL,
clicks BIGINT UNSIGNED NOT NULL DEFAULT 0,
created_at DATETIME NOT NULL,
PRIMARY KEY (id)
) $charset;";

$sql[] = "CREATE TABLE {$wpdb->prefix}bsms_private_proofs (
 id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 filename VARCHAR(255) NOT NULL,
 mime VARCHAR(80) NOT NULL,
 data_base64 LONGTEXT NOT NULL,
 request_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL,
 PRIMARY KEY (id),
 KEY user_id (user_id)
) $charset;";

foreach ($sql as $q) dbDelta($q);

        self::ensure_transactional_tables();
        self::ensure_api_credential_columns();
        self::migrate_provider_contract();
        if (class_exists('BSMS_Private_Proofs')) BSMS_Private_Proofs::migrate_existing();
        self::retire_legacy_wallet_balance();
        if (class_exists('BSMS_Funding')) BSMS_Funding::migrate();
        self::backfill_job_api_ids();
        if (class_exists('BSMS_Cron')) BSMS_Cron::recover_stranded_campaigns();

        // 3.2.39.5: API access is a standard account capability. Existing
        // installations previously defaulted this feature off, so normalise
        // the platform/member defaults once during this upgrade. Per-user
        // entitlement overrides and account suspension still act as kill switches.
        $previous_version = (string)get_option('bsms_pro_db_version', '');
        if ($previous_version === '' || version_compare($previous_version, '3.2.39.5', '<')) {
            update_option('bsms_feature_api_access', '1', false);
            update_option('bsms_enable_member_api_access', 1, false);
        }
        // 3.6.2: one price list, no quantity bands, no "every other country" price.
        if (class_exists('BSMS_Pricing')) { BSMS_Pricing::seed_ng_prefixes(); BSMS_Pricing::unify_price_list(); BSMS_Pricing::seed_default_rates(); }
        BSMS_Cron::activate();
        update_option('bsms_pro_db_version', BSMS_PRO_VERSION);
    }

    public static function table_engine($table){
        global $wpdb;
        $table = (string)$table;
        if ($table === '') return '';
        // SHOW TABLE STATUS works on ordinary hosting accounts without requiring
        // direct information_schema SELECT privileges. Fall back when available.
        $like = $wpdb->esc_like($table);
        $row = $wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS LIKE %s', $like), ARRAY_A);
        if (is_array($row) && !empty($row['Engine'])) return strtolower((string)$row['Engine']);
        $engine = $wpdb->get_var($wpdb->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s', $table));
        return strtolower((string)$engine);
    }

    public static function ensure_transactional_tables(){
        global $wpdb;
        foreach (array(self::table('wallets'), self::table('ledger'), self::table('campaigns'), self::table('jobs')) as $table) {
            $engine = self::table_engine($table);
            if ($engine === 'innodb') continue;
            // These tables participate in financial/campaign transactions and are
            // product-owned. Upgrade them explicitly rather than failing every send.
            $safe = preg_replace('/[^A-Za-z0-9_]/', '', $table);
            if ($safe === '') continue;
            $ok = $wpdb->query($wpdb->prepare('ALTER TABLE %i ENGINE=InnoDB', $safe));
            if ($ok === false || self::table_engine($table) !== 'innodb') {
                if (defined('WP_DEBUG') && WP_DEBUG) error_log('[Bulk SMS Portal DB] Could not ensure InnoDB for ' . $safe . ': ' . $wpdb->last_error); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Written only when WP_DEBUG is on.
            }
        }
    }

    public static function ensure_api_credential_columns(){
        global $wpdb;
        $t = self::table('apis');
        $cols = $wpdb->get_col("DESC {$wpdb->prefix}bsms_apis", 0);
        if (!is_array($cols)) $cols = array();
        if (!in_array('api_username', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD api_username VARCHAR(255) NULL AFTER balance_url");
        }
        if (!in_array('api_password', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD api_password TEXT NULL AFTER api_username");
        }
        if (!in_array('dlr_lookup_url', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD dlr_lookup_url TEXT NULL AFTER dlr_url");
        }
        if (!in_array('dlr_status_pattern', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD dlr_status_pattern VARCHAR(255) NULL AFTER dlr_lookup_url");
        }

        if (!in_array('dlr_success_codes', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD dlr_success_codes TEXT NULL AFTER dlr_status_pattern");
        }
        if (!in_array('dlr_failure_codes', $cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_apis ADD dlr_failure_codes TEXT NULL AFTER dlr_success_codes");
        }

        $jobs = self::table('jobs');
        $job_cols = $wpdb->get_col("DESC {$wpdb->prefix}bsms_jobs", 0);
        if (is_array($job_cols) && !in_array('api_id', $job_cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_jobs ADD api_id BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER provider");
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_jobs ADD KEY api_id (api_id)");
        }
        if (is_array($job_cols) && !in_array('last_synced_at', $job_cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_jobs ADD last_synced_at DATETIME NULL AFTER provider_status");
        }
        if (is_array($job_cols) && !in_array('sync_notes', $job_cols, true)) {
            $wpdb->query("ALTER TABLE {$wpdb->prefix}bsms_jobs ADD sync_notes TEXT NULL AFTER last_synced_at");
        }
    }

    /** v3.2.91: remove legacy/example delivery settings and reconcile canonical routing. */
    public static function migrate_provider_contract(){
        global $wpdb;
        $t = self::table('apis');
        $rows = $wpdb->get_results("SELECT * FROM {$wpdb->prefix}bsms_apis");
        if (!is_array($rows)) return;
        $active_normal = array();
        foreach ($rows as $api) {
            $id = intval($api->id ?? 0);
            if ($id <= 0) continue;
            $lookup = trim((string)($api->dlr_lookup_url ?? ''));
            $push = trim((string)($api->dlr_url ?? ''));
            $placeholder = $lookup !== '' && preg_match('~^https?://(?:www\.)?provider\.example(?:/|$)~i', $lookup);
            if ($placeholder) {
                $wpdb->update($t, array('dlr_lookup_url'=>'','dlr_status_pattern'=>'','dlr_success_codes'=>'','dlr_failure_codes'=>''), array('id'=>$id));
                $lookup = '';
            }
            // Legacy UI used submission-success codes as delivery-success codes. If no real
            // pull or push DLR mechanism exists, those fields are not operational and must
            // not make the provider appear delivery-enabled.
            if ($lookup === '' && $push === '') {
                $wpdb->update($t, array('dlr_status_pattern'=>'','dlr_success_codes'=>'','dlr_failure_codes'=>''), array('id'=>$id));
            }
            $route = class_exists('BSMS_Providers') ? BSMS_Providers::normalise_route($api->assigned_route ?? 'normal') : strtolower((string)($api->assigned_route ?? 'normal'));
            if (!empty($api->is_active) && $route === 'normal') $active_normal[] = $id;
        }
        $default_id = intval(get_option('bsms_default_api_id', 0));
        $default_valid = false;
        foreach ($rows as $api) {
            if (intval($api->id ?? 0) === $default_id && !empty($api->is_active)) { $default_valid = true; break; }
        }
        if ((!$default_valid || $default_id <= 0) && count($active_normal) === 1) {
            update_option('bsms_default_api_id', intval($active_normal[0]));
        }
        delete_option('bsms_route_api_normal');
        delete_option('bsms_route_api_standard');
    }

    /**
     * v3.4.1: the pre-0.5 "balance_kobo" column is retired.
     *
     * Earlier builds copied balance_kobo into the SMS wallet on EVERY plugin
     * update whenever a customer's SMS balance was exactly zero. balance_kobo was
     * never reduced, so customers with an old balance were credited again after
     * each update, without a ledger entry. The copy is not run again: the legacy
     * values are saved to an option for reference and the column is cleared.
     */
    public static function retire_legacy_wallet_balance(){
        global $wpdb;
        if (get_option('bsms_legacy_balance_retired') === '1') return;
        $t = self::table('wallets');
        $rows = $wpdb->get_results("SELECT user_id, balance_kobo FROM {$wpdb->prefix}bsms_wallets WHERE balance_kobo<>0", ARRAY_A);
        if ($rows) {
            $backup = array();
            foreach ($rows as $row) $backup[intval($row['user_id'])] = intval($row['balance_kobo']);
            update_option('bsms_legacy_balance_backup', $backup, false);
            $wpdb->query("UPDATE {$wpdb->prefix}bsms_wallets SET balance_kobo=0 WHERE balance_kobo<>0");
            if (class_exists('BSMS_Security')) BSMS_Security::log('legacy_wallet_balance_retired', 'Legacy wallet balance column cleared', array('wallets'=>count($backup)));
        }
        update_option('bsms_legacy_balance_retired', '1', false);
    }

    /**
     * Customers whose SMS wallet balance differs from the sum of their ledger.
     * Every balance change since the ledger was introduced is written to it, so
     * a difference points to an unrecorded credit (such as the old migration)
     * or a manual database edit.
     */
    /**
     * v3.4.2: before this version accepted messages did not record which SMS
     * provider took them. When the site has only ever had one provider the
     * answer is certain, so fill it in; otherwise leave it unknown.
     */
    public static function backfill_job_api_ids(){
        global $wpdb;
        if (get_option('bsms_job_api_backfill_342') === '1') return;
        $apis = $wpdb->get_col("SELECT id FROM {$wpdb->prefix}bsms_apis");
        if (is_array($apis) && count($apis) === 1) {
            $wpdb->query($wpdb->prepare("UPDATE {$wpdb->prefix}bsms_jobs SET api_id=%d WHERE api_id=0 AND provider='api' AND provider_message_id IS NOT NULL AND provider_message_id<>''", intval($apis[0])));
        }
        update_option('bsms_job_api_backfill_342', '1', false);
    }

    /** v3.4.1 money integrity checks shared by both System Checks screens: array of [label, ok, detail]. */
    public static function money_integrity_checks(){
        $checks = array();
        $mismatch = self::wallet_mismatches(200);
        if (!$mismatch) {
            $checks[] = array(__('Wallet balances match the ledger', 'bulk-sms-portal'), true, __('Every SMS wallet equals the sum of its recorded transactions.', 'bulk-sms-portal'));
        } else {
            $parts = array();
            foreach (array_slice($mismatch, 0, 5) as $m) {
                $u = get_user_by('id', intval($m['user_id']));
                $name = $u ? ($u->display_name ?: $u->user_login) : (sprintf(/* translators: %s: a value filled in when shown */ __('User #%s', 'bulk-sms-portal'), intval($m['user_id'])));
                $diff = intval($m['difference_kobo']);
                $parts[] = $name . __(': wallet ', 'bulk-sms-portal') . BSMS_Util::money($m['sms_balance_kobo']) . __(', ledger ', 'bulk-sms-portal') . BSMS_Util::money($m['ledger_kobo']) . ' (' . ($diff > 0 ? '+' : '') . BSMS_Util::money($diff) . ')';
            }
            $checks[] = array(__('Wallet balances match the ledger', 'bulk-sms-portal'), false, sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s wallet(s) differ from their transaction history. %2$s%3$s. Differences can come from balances held before the ledger existed or from the old update re-credit bug; review each before adjusting.', 'bulk-sms-portal'), count($mismatch), implode('; ', $parts), (count($mismatch) > 5 ? '; …' : '')));
        }
        $secret = (string)get_option('bsms_paystack_secret_key', '');
        $test_key = strpos($secret, 'sk_test_') === 0;
        $test_mode = intval(get_option('bsms_payment_test_mode', 0)) === 1;
        $checks[] = array(__('Paystack keys are live', 'bulk-sms-portal'), !$test_key || $test_mode, $secret === '' ? __('Paystack is not configured.', 'bulk-sms-portal') : ($test_key ? ($test_mode ? __('Test keys with payment test mode on: payments will not move real money.', 'bulk-sms-portal') : __('A Paystack TEST secret key is saved but test mode is off. Customers cannot pay real money and test payments will not be credited. Save your live keys.', 'bulk-sms-portal')) : __('Live secret key saved.', 'bulk-sms-portal')));
        $unconfirmed = intval($GLOBALS['wpdb']->get_var($GLOBALS['wpdb']->prepare("SELECT COUNT(*) FROM " . self::table('jobs') . " WHERE provider_status='NO_FINAL_CONFIRMATION' AND updated_at >= %s", gmdate('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS))));
        $checks[] = array(__('Messages closed without confirmation (30 days)', 'bulk-sms-portal'), $unconfirmed === 0, sprintf(/* translators: %s: a value filled in when shown */ __('%s message(s) were charged but never confirmed by the SMS service. Review them in Message History (admins can mark a message failed to refund it).', 'bulk-sms-portal'), $unconfirmed));
        if (class_exists('BSMS_Funding')) {
            $doubles = BSMS_Funding::possible_double_credits();
            $checks[] = $doubles
                ? array(__('Online payments credited once', 'bulk-sms-portal'), false, sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s online payment(s) were credited both by an admin approval and by the payment provider: %2$s. Review and reverse the extra credit if needed.', 'bulk-sms-portal'), count($doubles), implode(', ', array_map(function($d){ return $d->reference . ' (' . BSMS_Util::money($d->amount_kobo) . ')'; }, array_slice($doubles, 0, 5)))))
                : array(__('Online payments credited once', 'bulk-sms-portal'), true, __('No online payment was credited twice.', 'bulk-sms-portal'));
        }
        return $checks;
    }

    public static function wallet_mismatches($limit=200){
        global $wpdb;
        $w = self::table('wallets');
        $l = self::table('ledger');
        return $wpdb->get_results($wpdb->prepare(
            "SELECT w.user_id, w.sms_balance_kobo, COALESCE(x.total,0) AS ledger_kobo, w.sms_balance_kobo-COALESCE(x.total,0) AS difference_kobo
             FROM {$wpdb->prefix}bsms_wallets w LEFT JOIN (SELECT user_id, SUM(amount_kobo) AS total FROM {$wpdb->prefix}bsms_ledger WHERE wallet='sms' GROUP BY user_id) x ON x.user_id=w.user_id
             WHERE w.sms_balance_kobo<>COALESCE(x.total,0)
             ORDER BY ABS(w.sms_balance_kobo-COALESCE(x.total,0)) DESC LIMIT %d", intval($limit)), ARRAY_A);
    }
}