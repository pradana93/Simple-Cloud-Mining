<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Contents_model extends MY_Model
{
	function __construct()
	{
		parent::__construct();
		$this->table_name = 'contents';
	}

    public function update()
	{
		$data = array(
			'affiliate' => htmlspecialchars($this->input->post('affiliate', false)),
			'payouts' => htmlspecialchars($this->input->post('payouts', false)),
			'contact' => htmlspecialchars($this->input->post('contact', false)),
		);
		$this->db->where('id',1);
		return $this->db->update($this->table_name,$data);
	}
}
