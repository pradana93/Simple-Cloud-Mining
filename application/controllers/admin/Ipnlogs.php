<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Ipnlogs extends Admin_Controller
{
	private $logViewer;

	public function __construct()
	{
		parent::__construct();
		$this->is_admin_loggedin();
		$this->load->model('ipnlogs_model');
		$this->logViewer = new \CILogViewer\CILogViewer();
	}

	public function index()
    {
		$results = $this->admin_paginate('ipnlogs_model',adminRoute('ipnlogs'));
		$this->admin_view('ipnlogs/list', [
			'items' => $results['items'],
			'total_items' => $results['total'],
			'pagination_links' => $results['links'],
		]);
    }

	public function view($id)
	{
		$item = $this->ipnlogs_model->getById('inp_errors',$id);
		$transaction = $this->ipnlogs_model->getById('transactions_history', $item['transaction_id']);
		$this->admin_view('ipnlogs/view',[
			'item' => $item,
			'transaction' => $transaction,
		]);
	}

	public function showLogs()
	{
		$this->load->view('admin/includes/header');
		$this->load->view('admin/ipnlogs/showlogs');
		$this->load->view('admin/includes/footer');
	}

	public function showLogsList()
	{
		echo $this->logViewer->showLogs();
	}
}
