<?php
defined('BASEPATH') or exit('No direct script access allowed');

$composer = file_get_contents(dirname(BASEPATH) . '/composer.json');
define('SC_VERSION', json_decode($composer, 1)['version']);
define('SC_NAME', 'SCM - Simple Cloud Mining Script');

//Generate admin assets routes
if (!function_exists('adminAssets')) {
	function adminAssets($file = null)
	{
		return base_url() . 'assets/admin/' . $file;
	}
}

//Generate admin assets routes
if (!function_exists('plansAssets')) {
	function plansAssets($file = null)
	{
		return base_url() . 'assets/plans/' . $file;
	}
}

//Generate theme assets routes
if (!function_exists('themeAssets')) {
	function themeAssets($file = null)
	{
		return base_url() . 'assets/themes/' . settings('theme') . '/' . $file;
	}
}

//Generate admin routes
if (!function_exists('adminRoute')) {
	function adminRoute($route = null)
	{
		$adminPrefix = config_item('admin_route_prefix');
		return base_url($adminPrefix . '/' . $route);
	}
}

//Generate install routes
if (!function_exists('installRoute')) {
	function installRoute($route = null)
	{
		$secureUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === "on" ? 'https://' : 'http://');
		return $secureUrl . $_SERVER['SERVER_NAME'] . '/' . $route;
	}
}

//Format currency decimals
if (!function_exists('currencyFormat')) {
	function currencyFormat($amount, $decimals = 8)
	{
		$set_decimals = $decimals ?? settings('currency_decimals');
		return number_format($amount, $set_decimals, '.', '');
	}
}

//Get plans images
if (!function_exists('getPlansImages')) {
	//Plans images
	function getPlansImages()
	{
		$directory = scandir(dirname(BASEPATH) . '/assets/plans');
		$t = array();
		foreach ($directory as $value) {
			if ($value === '.' || $value === '..') {
				continue;
			}
			$t[] = $value;
		}
		return $t;
	}
}

//Get themes
if (!function_exists('getThemes')) {
	function getThemes()
	{
		$directory = scandir(dirname(BASEPATH) . '/assets/themes/');
		$t = array();
		foreach ($directory as $value) {
			if ($value === '.' || $value === '..') {
				continue;
			}
			$t[] = $value;
		}
		return $t;
	}
}

if (!function_exists('settings')) {
	function settings($param)
	{
		$CI =& get_instance();
		$CI->load->driver('cache', ['adapter' => 'file']);
		$settings = $CI->cache->get('settings');
		if(empty($settings)){
			$CI->cache->save('settings', $CI->settings_model->getById('settings', 1), 1800); // 30min
		}
		$settings = $CI->cache->get('settings');
		return $settings[$param];
	}
}

if (!function_exists('plugins_menu')) {
	function plugins_menu()
	{
		$CI =& get_instance();
		$CI->load->model('addons_model');
		$items = $CI->addons_model->getAddonsMenu();
		foreach ($items as $item) {
			$active = $CI->uri->segment(2) === $item['route'] ? "active" : "";
			echo '<li class="' . $active . '"><a href="' . adminRoute($item['route']) . '"><i class="fa ' . $item['icon'] . '"></i> ' . $item['name'] . '</a></li>';
		}
	}
}

if (!function_exists('blockchainUrl')) {
	function blockchainUrl($tx = null)
	{
		$CI =& get_instance();
		$CI->load->driver('cache', ['adapter' => 'file']);
		$default = $CI->cache->get('blockchainUrl');
		if(!$default){
			$CI->load->model('blockchains_model');
			$CI->cache->save('blockchainUrl', $CI->blockchains_model->getDefault(), 86400); // 24 hours
		}
		$default = $CI->cache->get('blockchainUrl');
		return $default['url'] . $tx;
	}
}

if (!function_exists('project_start_date')) {
	function project_start_date()
	{
		$start_date = date_create(settings('start_date'));
		$add_days = settings('start_date_increment');
		return date_create()->diff($start_date)->days + $add_days;
	}
}
if (!function_exists('check_updates')) {
	/**
	 * @param $sku
	 * @param $current_version
	 * @return object
	 * @throws Exception
	 */
	function check_updates($sku = 'scmdogeminer', $current_version = SC_VERSION)
	{
		$url = 'https://smartyscripts.com/api/checkupdates';
		// Initiate cURL and set headers/options
		$ch  = curl_init();

		// If we run windows, make sure the needed pem file is used
		if(strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
			$pemfile = dirname(realpath(__FILE__)) . DIRECTORY_SEPARATOR . 'cacert.pem';
			if(!file_exists($pemfile)) {
				throw new Exception("Needed .pem file not found. Please download the .pem file at http://curl.haxx.se/ca/cacert.pem and save it as " . $pemfile);
			}
			curl_setopt($ch, CURLOPT_CAINFO, $pemfile);
		}
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_FAILONERROR, true);
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_POSTFIELDS, ['sku' => $sku]);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		// Execute the cURL request
		$result = curl_exec($ch);
		$available_version = json_decode($result);
		if (curl_errno($ch)) {
			$error_msg = curl_error($ch);
		}
		$responseCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if($responseCode !== 200){
			return (object)[
				'success' => false,
				'message' => $error_msg
			];
		}
		if($available_version > $current_version){
			$message = 'New version available: v'.$available_version. '. Go to <a href="https://smartyscripts.com" target="_blank">Smarty Scripts</a> to download the new version.';
		}else{
			$message = 'You have the latest version: v'.$current_version;
		}
		return (object)[
			'success' => true,
			'message' => $message
		];
	}
}

if (!function_exists('get_fixed_texts')) {
	function get_fixed_texts($page_name)
	{
		$CI =& get_instance();
		$CI->load->driver('cache', ['adapter' => 'file']);
		$contents = $CI->cache->get('contents');
		if (!$contents) {
			$CI->load->model('contents_model');
			$CI->cache->save('contents', $CI->contents_model->getById('contents', 1), 86400); // 24h
		}
		$contents = $CI->cache->get('contents');
		//Parse contents
		return parse_text_codes($contents[$page_name]);
	}
}

if (!function_exists('get_faqs')) {
	function get_faqs()
	{
		$CI =& get_instance();
		$CI->load->driver('cache', ['adapter' => 'file']);
		$faqs = $CI->cache->get('faqs');
		if (empty($faqs)) {
			$CI->load->model('faqs_model');
			$CI->cache->save('faqs', $CI->faqs_model->getAll(), 86400); // 24h
		}
		$faqs = $CI->cache->get('faqs');
		//Parse contents
		return $faqs;
	}
}

if (!function_exists('parse_text_codes')) {
	function parse_text_codes($content)
	{
		//Parse contents
		$decoded_content = htmlspecialchars_decode($content);
		$result_content = preg_replace("'\{url:(.*?)\}'i", base_url('$1'), $decoded_content);
		$result_content = preg_replace_callback("'\{setting:(.*?)\}'i", function($param_name){ return settings($param_name[1]);}, $result_content);

		return $result_content;
	}
}
