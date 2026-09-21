<?php
defined('BASEPATH') or exit('No direct script access allowed');

class Update extends Admin_Controller
{
	public function __construct()
	{
		parent::__construct();
		$this->is_admin_loggedin();
	}

	public function index()
	{

		$this->admin_view('update', [
		]);
	}

	public function check()
	{
		$check = check_updates();
		if(!$check->success){
			$this->session->set_flashdata('error_msg', $check->message);
		}else{
			$this->session->set_flashdata('success_msg', $check->message);
		}
		redirect(adminRoute('update'));
	}
}
