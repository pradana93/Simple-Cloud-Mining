<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Faqs extends Admin_Controller
{
	public function __construct()
	{
		parent::__construct();
		$this->is_admin_loggedin();
		$this->load->model('faqs_model');
	}

	public function index()
    {
		$results = $this->admin_paginate('faqs_model',adminRoute('faqs'));
		$this->admin_view('faqs/list', [
			'items' => $results['items'],
			'total_items' => $results['total'],
			'pagination_links' => $results['links'],
		]);
    }

    public function create()
	{
		$this->form_validation->set_rules('question', 'Question', 'trim|required|min_length[4]');
		$this->form_validation->set_rules('answer', 'Answer', 'trim|required');

		if ($this->form_validation->run() === TRUE) {
			if($this->faqs_model->create()){
				$this->session->set_flashdata('success_msg','New F.A.Q. created with success!');
				//Clear cache data
				$this->clearCache();
				redirect(adminRoute('faqs'));
			}
			redirect(current_url());
		}

		$this->admin_view('faqs/add', [
			'codes' => $this->faqs_model->getCodes(),
		]);
	}

    public function edit($id)
	{
		$this->form_validation->set_rules('question', 'Question', 'trim|required|min_length[4]');
		$this->form_validation->set_rules('answer', 'Answer', 'trim|required');

		if ($this->form_validation->run() === TRUE) {
			if($this->faqs_model->update($id)){
				$this->session->set_flashdata('success_msg','F.A.Q. updated with success!');
				//Clear cache data
				$this->clearCache();
				redirect(adminRoute('faqs'));
			}
			redirect(current_url());
		}

		$this->admin_view('faqs/edit',[
			'item' => $this->faqs_model->getById('faqs',$id),
			'codes' => $this->faqs_model->getCodes(),
		]);
	}

    public function delete($id)
	{
		if($this->faqs_model->delete($id)){
			$this->session->set_flashdata('success_msg','F.A.Q. deleted with success!');
			//Clear cache data
			$this->clearCache();
		}
		redirect(adminRoute('faqs'));
	}

	private function clearCache()
	{
		$this->load->driver('cache', ['adapter' => 'file']);
		$this->cache->save('faqs', $this->faqs_model->getAll(), 86400); // 24h
	}
}
