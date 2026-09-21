<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Contents extends Admin_Controller
{
	public function __construct()
	{
		parent::__construct();
		$this->is_admin_loggedin();
		$this->load->model('contents_model');
	}

	public function index()
	{
		$this->form_validation->set_rules('affiliate', 'Affiliate Program', 'trim|required');
		$this->form_validation->set_rules('payouts', 'Payouts', 'trim|required');
		$this->form_validation->set_rules('contact', 'Contact', 'trim|required');

		if ($this->form_validation->run() === TRUE) {
			if ($this->ion_auth->user()->row()->id != 1) {
				$this->session->set_flashdata('error_msg', 'You are not authorized to modify this data!');
				redirect(current_url());
			}
			if ($this->contents_model->update()) {
				$this->load->driver('cache', ['adapter' => 'file']);
				$this->cache->save('contents', $this->contents_model->getById('contents', 1), 86400); // 24h
				$this->session->set_flashdata('success_msg', 'Contents updated with success!');
			}
			redirect(current_url());
		}

		$this->admin_view('contents', [
			'item' => $this->contents_model->getById('contents', 1),
			'codes' => $this->contents_model->getCodes(),
		]);
	}

	public function clearCache()
	{
		$this->load->driver('cache', ['adapter' => 'file']);
		$this->cache->clean();

		$this->session->set_flashdata('success_msg', 'Cache cleared successfully!');
		redirect(adminRoute('contents'));
	}
}
