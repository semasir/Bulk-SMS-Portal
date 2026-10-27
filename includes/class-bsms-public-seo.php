<?php
/**
 * Search engines: the sign-in, portal and payment pages are kept out of
 * search results and out of the WordPress and Yoast sitemaps.
 */
if (!defined('ABSPATH')) exit;
final class BSMS_Public_SEO {
    private static function app_slugs(){
        $portal = class_exists('BSMS_Portal') && method_exists('BSMS_Portal', 'portal_slug') ? BSMS_Portal::portal_slug() : 'portal';
        return array_values(array_unique(array('login','register','forgot-password','payment-status','portal',$portal,'buy-sms')));
    }
/** IDs of the sign-in, portal and payment pages (never shown in search). */
    private static function app_page_ids(){
        static $ids = null;
        if ($ids !== null) return $ids;
        $ids = array();
        foreach (self::app_slugs() as $slug) { $p = get_page_by_path($slug); if ($p) $ids[] = (int)$p->ID; }
        return $ids;
    }
    public static function init(){
        add_filter('wp_robots', array(__CLASS__, 'core_robots'), 20);
        add_filter('wp_sitemaps_posts_query_args', array(__CLASS__, 'core_sitemap_args'), 20, 2);
        add_filter('wpseo_exclude_from_sitemap_by_post_ids', array(__CLASS__, 'exclude_app_pages'), 98);
        add_filter('wpseo_robots', array(__CLASS__, 'app_robots'), 998);
    }
    public static function core_robots($robots){
        if (is_page(self::app_slugs())) { $robots['noindex'] = true; $robots['follow'] = true; unset($robots['index'], $robots['max-image-preview']); }
        return $robots;
    }
    public static function core_sitemap_args($args, $post_type){
        if ($post_type !== 'page') return $args;
        $args['post__not_in'] = array_values(array_unique(array_merge((array)($args['post__not_in'] ?? array()), self::app_page_ids()))); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- Keeps the few portal pages out of the sitemap.
        return $args;
    }
    public static function exclude_app_pages($ids){
        return array_values(array_unique(array_merge(is_array($ids) ? array_map('intval', $ids) : array(), self::app_page_ids())));
    }
    public static function app_robots($robots){
        return is_page(self::app_slugs()) ? 'noindex, follow' : $robots;
    }
}
