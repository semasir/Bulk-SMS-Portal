<?php
if (!defined('ABSPATH')) { exit; }

// phpcs:disable WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
// This plugin keeps wallets, messages and prices in its own database tables, so it
// reads and writes them with $wpdb. Values always go through $wpdb->prepare() or
// the $wpdb->insert()/update() helpers; results that change often are not cached.

/** Bank-transfer files are kept in the database, outside public Media URLs. */
class BSMS_Private_Proofs {
    const FIRST_PRIVATE_ID = 1000000000000;
    public static function init(){ add_action('bsms_migrate_legacy_proofs', array(__CLASS__, 'migrate_existing')); }

    public static function store($user_id, $path, $name, $mime, $id=0){
        global $wpdb;
        if (!is_file($path) || filesize($path) <= 0 || filesize($path) > 5 * 1024 * 1024) return new WP_Error('invalid_proof', __('Choose a payment proof smaller than 5 MB.', 'bulk-sms-portal'));
        $allowed = array('image/jpeg','image/png','image/webp','application/pdf');
        if (!in_array($mime, $allowed, true)) return new WP_Error('invalid_proof', __('Choose a JPG, PNG, WebP or PDF payment proof.', 'bulk-sms-portal'));
        $bytes = file_get_contents($path);
        if ($bytes === false) return new WP_Error('proof_unavailable', __('The payment proof could not be saved. Please try again.', 'bulk-sms-portal'));
        $encoded = base64_encode($bytes);
        $table = BSMS_DB::table('private_proofs');
        if (!$id) {
            $wpdb->query("DELETE FROM {$wpdb->prefix}bsms_private_proofs WHERE request_id=0 AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)");
            $pending = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$wpdb->prefix}bsms_private_proofs WHERE user_id=%d AND request_id=0", $user_id)));
            if ($pending >= 5) return new WP_Error('proof_limit', __('You have several unfinished uploads. Please finish a payment request or try again tomorrow.', 'bulk-sms-portal'));
        }
        $id = $id ?: wp_rand(self::FIRST_PRIVATE_ID, 9999999999999);
        $ok = $wpdb->insert($table, array('id'=>$id,'user_id'=>absint($user_id),'filename'=>sanitize_file_name($name),'mime'=>$mime,'data_base64'=>$encoded,'created_at'=>BSMS_Util::now_gmt()), array('%d','%d','%s','%s','%s','%s'));
        if ($ok === false) return new WP_Error('proof_unavailable', __('The payment proof could not be saved. Please try again.', 'bulk-sms-portal'));
        $saved = $wpdb->get_var($wpdb->prepare("SELECT LENGTH(data_base64) FROM {$wpdb->prefix}bsms_private_proofs WHERE id=%d AND user_id=%d", $id, $user_id));
        if (intval($saved) !== strlen($encoded)) return new WP_Error('proof_unavailable', __('The payment proof could not be checked. Please contact support.', 'bulk-sms-portal'));
        return $id;
    }

    public static function row($id){
        global $wpdb;
        $table = BSMS_DB::table('private_proofs');
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}bsms_private_proofs WHERE id=%d", absint($id)));
    }

    private static function migrate_attachment($id, $owner){
        $path = get_attached_file($id);
        $upload = wp_upload_dir();
        $basedir = realpath($upload['basedir']);
        $real = $path ? realpath($path) : false;
        if (!$basedir || !$real || strpos($real, $basedir . DIRECTORY_SEPARATOR) !== 0 || strpos(basename($real), 'funding-proof-') !== 0) return;
        $result = self::store($owner, $real, basename($real), (string)get_post_mime_type($id), $id);
        if (!is_wp_error($result) && !wp_delete_attachment($id, true) && is_file($real)) update_option('bsms_legacy_proof_cleanup_failed', 1, false);
    }

    public static function migrate_existing($limit=50){
        global $wpdb;
        $fr = BSMS_DB::table('funding_requests');
        $private = BSMS_DB::table('private_proofs');
        $limit = max(1, min(50, absint($limit)));
        $rows = $wpdb->get_results($wpdb->prepare("SELECT fr.proof_attachment_id id, MIN(fr.user_id) user_id, MIN(fr.id) request_id FROM {$wpdb->prefix}bsms_funding_requests fr LEFT JOIN {$wpdb->prefix}bsms_private_proofs p ON p.id=fr.proof_attachment_id WHERE fr.proof_attachment_id>0 AND fr.proof_attachment_id<%d AND p.id IS NULL GROUP BY fr.proof_attachment_id ORDER BY fr.proof_attachment_id ASC LIMIT %d", self::FIRST_PRIVATE_ID, $limit));
        foreach ((array)$rows as $row) {
            self::migrate_attachment(absint($row->id), absint($row->user_id));
            if (self::row($row->id)) {
                $wpdb->update($private, array('request_id'=>absint($row->request_id)), array('id'=>absint($row->id)));
                $wpdb->update($fr, array('proof_url'=>''), array('proof_attachment_id'=>absint($row->id)));
            }
        }
        // Also move receipts uploaded before a bank-transfer request was submitted.
        $pending = $wpdb->get_results($wpdb->prepare("SELECT m.post_id id, m.meta_value user_id FROM {$wpdb->postmeta} m LEFT JOIN {$wpdb->prefix}bsms_private_proofs p ON p.id=m.post_id WHERE m.meta_key='_bsms_funding_proof_owner' AND m.post_id<%d AND p.id IS NULL ORDER BY m.post_id ASC LIMIT %d", self::FIRST_PRIVATE_ID, $limit));
        foreach ((array)$pending as $item) self::migrate_attachment(absint($item->id), absint($item->user_id));
        $remaining_linked = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT fr.proof_attachment_id) FROM {$wpdb->prefix}bsms_funding_requests fr LEFT JOIN {$wpdb->prefix}bsms_private_proofs p ON p.id=fr.proof_attachment_id WHERE fr.proof_attachment_id>0 AND fr.proof_attachment_id<%d AND p.id IS NULL", self::FIRST_PRIVATE_ID)));
        $remaining_pending = intval($wpdb->get_var($wpdb->prepare("SELECT COUNT(DISTINCT m.post_id) FROM {$wpdb->postmeta} m LEFT JOIN {$wpdb->prefix}bsms_private_proofs p ON p.id=m.post_id WHERE m.meta_key='_bsms_funding_proof_owner' AND m.post_id<%d AND p.id IS NULL", self::FIRST_PRIVATE_ID)));
        $remaining = $remaining_linked + $remaining_pending;
        update_option('bsms_legacy_public_proofs_remaining', $remaining, false);
        if ($remaining && !wp_next_scheduled('bsms_migrate_legacy_proofs')) wp_schedule_single_event(time()+300, 'bsms_migrate_legacy_proofs');
    }
}
