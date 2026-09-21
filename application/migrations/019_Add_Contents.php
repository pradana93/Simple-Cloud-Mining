<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Add_Contents extends CI_Migration {

	public function up()
	{
		$this->dbforge->add_field(array(
			'id' => array(
				'type' => 'INT',
				'constraint' => 11,
				'unsigned' => TRUE,
				'auto_increment' => TRUE
			),
			'affiliate' => array(
				'type' => 'longtext',
				'default' => null,
				'null' => true,
			),
			'payouts' => array(
				'type' => 'longtext',
				'default' => null,
				'null' => true,
			),
			'contact' => array(
				'type' => 'longtext',
				'default' => null,
				'null' => true,
			),
		));
		$this->dbforge->add_key('id', TRUE);
		$this->dbforge->create_table('contents');

		//Create default contents
		$this->db->insert('contents', [
		'affiliate' => '<p>Invite your friends and get {setting:aff_comission}% each time they upgrade <strong>{setting:sitename}</strong>. </p>
				<h2 class="title-section text-center">Upgrade to Premium</h2>
				<p>
					You can also <a href="{url:dashboard}">Upgrade Mining</a> to increase affiliate rate {setting:aff_comission}%.
				</p>
				<p>
					<strong>{setting:sitename}</strong> is an industry leading {setting:currency_name} mining pool. All of the mining power is backed up by physical miners. Mining with the latest algorithms allows to make as much {setting:currency_name} as possible. We aim to provide you with the easiest possible way to make money without having to do any of the hard stuff.
				</p>
				<p>
					With data centers around the globe, we aim to keep bills down and mining power high, meaning you can make more in a shorter amount of time than what it would take to mine from your home for instance. Our data centers are located in Europe, USA and China with dedicated Up-Links and 99% uptime!
				</p>',
		'payouts' => '<p>We are experts in the field of trading and investment of {setting:currency_name}, and we\'re want to share our best practice with EVERYONE! {setting:currency_name} market capitalization growing everyday. Don\'t miss your chance to earn on this wave. Join our team now!</p> aaa',
		'contact' => '<p>Integer sit amet mattis quam, sit amet ultricies velit. Praesent ullamcorper dui turpis,Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Nulla mollis dapibus nunc, ut rhoncus turpis sodales quis. Integer sit amet mattis quam asdsasd.</p>'
		]);
	}

	public function down()
	{
		$this->dbforge->drop_table('contents');
	}
}
