<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Account extends MY_Controller
{
	public function __construct()
	{
		parent::__construct();
		$this->load->model('plans_model');
		$this->load->model('users_model');

		if(!$this->ion_auth->logged_in()){
			redirect(base_url());
		}
		$this->userdata = $this->ion_auth->user()->row();
		//Cache
		if(!$this->activeplans = $this->cache->get('active_plans_user_'.$this->userdata->id)){
			$this->activeplans = $this->users_model->getUserActivePlans();
			$this->cache->save('active_plans_user_'.$this->userdata->id, $this->activeplans, $this->config->item('active_plans_cache'));
		}
	}

	public function index()
	{
		//Cache
		if(!$paid_plans = $this->cache->get('paid_plans')){
			$paid_plans = $this->plans_model->getPaidPlans();
			$this->cache->save('paid_plans',$paid_plans, $this->config->item('plans_cache'));
		}
		if(!$user_earning_rate = $this->cache->get('mining_speed_user'.$this->userdata->id)){
			$user_earning_rate = $this->users_model->getUserMiningSpeed();
			$this->cache->save('mining_speed_user'.$this->userdata->id,$user_earning_rate, $this->config->item('earning_rate_cache'));
		}
		$this->site_view('dashboard',[
			'allplans' => $paid_plans,
			'userEarningRate' => $user_earning_rate,
			'active_plans' => $this->activeplans
		]);
	}

	public function history()
	{
		$this->form_validation->set_rules('email', 'Email', 'trim|required|valid_email|callback_edit_unique[users.email.'.$this->userdata->id.']');
		$this->form_validation->set_rules('password', 'Current Password', 'trim|required');
		$this->form_validation->set_rules('new_password', 'New Password', 'trim|min_length[4]|matches[new_password_confirmation]');
		$this->form_validation->set_rules('new_password_confirmation', 'Confirm New Password', 'trim|min_length[4]');

		if ($this->form_validation->run() === TRUE) {
			if(!$this->users_model->check_password($this->userdata->id)){
				$this->session->set_flashdata('error_msg','Invalid Current Password!');
				redirect(current_url());
			}
			if($this->users_model->update_user($this->userdata->id)){
				$this->session->set_flashdata('success_msg','Account updated with success!');
			}
			redirect(current_url());
		}

		//Cache
		if(!$referrals = $this->cache->get('referrals_user_'.$this->userdata->id)){
			$referrals = $this->users_model->user_referrals($this->userdata->id);
			$this->cache->save('referrals_user_'.$this->userdata->id,$referrals, $this->config->item('referrals_cache'));
		}
		if(!$aff_earns = $this->cache->get('aff_earns_user_'.$this->userdata->id)){
			$aff_earns = $this->users_model->user_comissions($this->userdata->id);
			$this->cache->save('aff_earns_user_'.$this->userdata->id,$aff_earns, $this->config->item('aff_earns_cache'));
		}
		if(!$deposits = $this->cache->get('deposits_user_'.$this->userdata->id)){
			$deposits = $this->users_model->user_deposits($this->userdata->id);
			$this->cache->save('deposits_user_'.$this->userdata->id,$deposits, $this->config->item('deposits_cache'));
		}
		if(!$withdrawals = $this->cache->get('withdrawals_user_'.$this->userdata->id)){
			$withdrawals = $this->users_model->user_withdrawals($this->userdata->id);
			$this->cache->save('withdrawals_user_'.$this->userdata->id,$withdrawals, $this->config->item('withdrawals_cache'));
		}
		if(!$pending_transactions = $this->cache->get('pending_transactions_user_'.$this->userdata->id)){
			$pending_transactions = $this->users_model->user_pending_transactions($this->userdata->id);
			$this->cache->save('pending_transactions_user_'.$this->userdata->id,$pending_transactions, $this->config->item('pending_transactions_cache'));
		}

		$this->site_view('account',[
			'referrals' => $referrals,
			'aff_earns' => $aff_earns,
			'deposits' => $deposits,
			'withdrawals' => $withdrawals,
			'transactions' => $pending_transactions,
		]);
	}

	public function withdrawal()
	{
		$this->form_validation->set_rules('amount', 'Amount', 'trim|required|numeric|greater_than_equal_to['.settings('min_withdraw').']|less_than_equal_to['.settings('max_withdraw').']');

		if ($this->form_validation->run() === TRUE)
		{
			if($this->input->post('amount',true) > $this->userdata->balance){
				$this->session->set_flashdata('error_msg','You don\'t have enough earning blance to withdrawal the given amount!');
				redirect(current_url());
			}
			if($this->users_model->request_withdrawal()){
				$this->session->set_flashdata('success_msg','Withdraw requested successfully!');
				redirect(current_url());
			}
		}
		$this->site_view('withdrawal');
	}

	public function purchase(int $plan_id)
	{
		$this->config->load('coinpayments');
		$CP_PV = $this->config->item('coin_pv');
		$CP_PB = $this->config->item('coin_pb');
		$CP_MID = $this->config->item('coin_mid');

		$plan = $this->plans_model->getById('plans',xss_clean($plan_id));
		if($plan)
		{
			$transaction_limit = settings('max_pending_transactions');
			$cp_mode = settings('coin_mode');
			//Count pending transactions
			$pending_transactions = $this->users_model->count_user_pending_transactions($this->userdata->id,$plan_id);
			if($pending_transactions < $transaction_limit){
				$hash = md5(settings('coin_hash') . time());
				//Payment
				if($cp_mode==='api'){
					//Check user email
					if(!$this->userdata->email){
						$this->session->set_flashdata('error_msg','Before made a purchase, you need update your contact email in your account!');
						redirect(base_url('dashboard'));
					}
					//Start API
					$cps_api = new CoinpaymentsAPI($CP_PV, $CP_PB, 'json');
					//Create transaction
					$result = $cps_api->CreateCustomTransaction([
						'amount' => $plan['price'],
						'currency1' => settings('coin_cur1'),
						'currency2' => settings('coin_cur2'),
						'item_name' => 'Purchase of Mining Plan '.$plan['version'].' on '.settings('sitename'),
						'item_number' => $plan['id'],
						'invoice' => $hash,
						'ipn_url' => base_url('ipn'),
						//'timeout' => 86399,
						'buyer_email' => settings('coin_email') === 'user' ? $this->userdata->email : settings('smtp_sender'),
					]);

					if($result['error'] !== 'ok'){
						$this->session->set_flashdata('error_msg','Error while trying to create payment. Contact admin.');
						log_message('error', 'Coinpayments API Error: '.$result['error']);
						redirect(base_url('dashboard'));
					}
					//Create transaction history
					$this->users_model->purchasePlan($this->userdata->id,$plan_id,$plan['price'], $hash,json_encode($result['result']));
					//Redirect to invoice
					redirect(base_url('invoice/'.$hash));
				}
				if($cp_mode==='gateway'){
					//Create Payment Link
					$req = [];
					$req['cmd'] = '_pay';
					$req['reset'] = 1;
					$req['merchant'] = $CP_MID;
					$req['item_name'] = html_entity_decode('Purchase of Mining Plan ' . $plan['version'] . ' on ' . settings('sitename'), ENT_QUOTES, 'UTF-8');
					$req['item_number'] = $plan['id'];
					$req['amountf'] = $plan['price'];
					$req['want_shipping'] = 0;
					$req['currency'] = settings('coin_cur1');
					$req['invoice'] = $hash;
					$req['success_url'] = base_url();
					$req['ipn_url'] = base_url('ipn');
					$req['cancel_url'] = base_url();
					$url = 'https://www.coinpayments.net/index.php';
					$url .= '?'.http_build_query($req);
					//Create transaction history
					$this->users_model->purchasePlan($this->userdata->id,$plan_id,$plan['price'], $hash, $url);
					redirect($url);
				}
			}
			$this->session->set_flashdata('error_msg','You have reached the transaction limit, wait for pending transactions to expire, or contact us if you have any questions.');
			redirect(base_url('dashboard'));
		}
		redirect(base_url('dashboard'));
	}

	public function invoice($hash)
	{
		if($hash){
			$invoice = $this->users_model->getInvoice(xss_clean($hash));
			if($invoice){
				$cp_mode = settings('coin_mode');
				if($cp_mode==='gateway'){
					redirect($invoice['params']);
				}
				$params = json_decode($invoice['params'],true);
				$left_time = date_add(date_create($invoice['date']), date_interval_create_from_date_string($params['timeout'].' seconds'));
				if(date_format($left_time, 'Y-m-d H:i:s') <= date('Y-m-d H:i:s')){
					$this->session->set_flashdata('error_msg','The payment deadline for this invoice has expired.');
					redirect(base_url('account'));
				}
				return $this->site_view('purchase',[
					'invoice' => $invoice,
					'params' => $params,
					'time_left' => $left_time->diff(date_create())
				]);
			}
		}
		redirect(base_url('dashboard'));
	}
}
