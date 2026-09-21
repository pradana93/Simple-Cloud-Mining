<?php
defined('BASEPATH') OR exit('No direct script access allowed');

/*
| -------------------------------------------------------------------------
| Cache settings
| -------------------------------------------------------------------------
*/
//Statistics cache (in seconds)
$config['statistics_cache'] = 60; //Default: 60 (1 min)
//Plans cache (in seconds)
$config['plans_cache'] = 1800; //Default: 1800 (30 min)
//User Earning Rate (in seconds)
$config['earning_rate_cache'] = 60; //Default: 60 (1 min)
//User Active Plans (in seconds)
$config['active_plans_cache'] = 60; //Default: 60 (1 min)
//User Referrals (in seconds)
$config['referrals_cache'] = 300; //Default: 300 (5 min)
//User Affiliate Earns (in seconds)
$config['aff_earns_cache'] = 300; //Default: 300 (5 min)
//User Deposits (in seconds)
$config['deposits_cache'] = 30; //Default: 30 (30 seconds)
//User Withdrawals (in seconds)
$config['withdrawals_cache'] = 30; //Default: 30 (30 seconds)
//User Pending Transactions (in seconds)
$config['pending_transactions_cache'] = 30; //Default: 30 (30 seconds)
