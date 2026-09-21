<?php
defined('BASEPATH') OR exit('No direct script access allowed');

class Migration_Add_Faqs extends CI_Migration {

	public function up()
	{
		$this->dbforge->add_field(array(
			'id' => array(
				'type' => 'INT',
				'constraint' => 11,
				'unsigned' => TRUE,
				'auto_increment' => TRUE
			),
			'question' => array(
				'type' => 'VARCHAR',
				'constraint' => '191',
			),
			'answer' => array(
				'type' => 'longtext',
			),
		));
		$this->dbforge->add_key('id', TRUE);
		$this->dbforge->create_table('faqs');
		//Create the default faqs
		$this->db->insert('faqs', ['question' => 'What is {setting:sitename}?', 'answer' => '<p><strong>{setting:sitename}</strong> is an industry leading {setting:currency_name} mining pool. All of the mining power is backed up by physical miners. Mining with the latest algorithms allows to make as much {setting:currency_name} as possible. We aim to provide you with the easiest possible way to make money without having to do any of the hard stuff. </p>
					<p>With data centers around the globe, we aim to keep bills down and mining power high, meaning you can make more in a shorter amount of time than what it would take to mine from your home for instance. Our data centers are located in Europe, USA and China with dedicated Up-Links and 99% uptime!</p>']);
		$this->db->insert('faqs', ['question' => 'How do I Start?', 'answer' => '<p>Sign up providing your wallet address and Start generating {setting:currency_name}. </p>']);
		$this->db->insert('faqs', ['question' => 'I don\'t have a {setting:currency_name} wallet. How can I create one?', 'answer' => '<p>You can create {setting:currency_name} wallet using online services like <a href="http://dogechain.info" target="_blank">dogechain.info</a>.</p>']);
		$this->db->insert('faqs', ['question' => 'I don\'t have {setting:currency_name}. Where can I get {setting:currency_name}?', 'answer' => '<p>You can buy and sell {setting:currency_name} on exchanges like <a href="http://okex.com" target="_blank">okex.com</a>,
	<a href="http://huobi.pro" target="_blank">huobi.pro</a>,
	<a href="http://binance.com" target="_blank">binance.com</a>,
	<a href="http://bitfinex.com" target="_blank">bitfinex.com</a>,
	<a href="http://upbit.com" target="_blank">upbit.com</a>,
	<a href="http://bithumb.com" target="_blank">bithumb.com</a>,
	<a href="http://gdax.com" target="_blank">gdax.com</a>,
	<a href="http://kraken.com" target="_blank">kraken.com</a>,
	<a href="http://bitstamp.net" target="_blank">bitstamp.net</a>,
	<a href="http://bittrex.com" target="_blank">bittrex.com</a>. Also you can use exchange service: <a href="https://www.changer.com/en/" target="_blank">changer.com</a>, <a href="https://24paybank.com/" target="_blank">24paybank.com</a>, <a href="https://prostocash.com/" target="_blank">prostocash.com</a>, <a href="https://ychanger.net/" target="_blank">ychanger.net</a>.</p>']);
		$this->db->insert('faqs', ['question' => 'How to change the address of the {setting:currency_name} wallet?', 'answer' => '<p>Wallet can not change.</p>']);
		$this->db->insert('faqs', ['question' => 'How much can I earn without investments?', 'answer' => '<p>You can generate 0.02 {setting:currency_code} every day without investments. You can also upgrade your <strong>{setting:sitename}</strong> to generate up to 50000+ {setting:currency_code} every day.</p>']);
		$this->db->insert('faqs', ['question' => 'How much can I earn on the partnership program?', 'answer' => '<p>You will earn {setting:aff_comission}% every time your referral gets upgrade.</p>']);
		$this->db->insert('faqs', ['question' => 'How long does it takes to withdraw money?', 'answer' => '<p>Withdrawal applications are generally processed instantly, in rare cases withdrawals can be processed manually and take longer.</p>']);
		$this->db->insert('faqs', ['question' => 'How long does it takes to receive a deposit?', 'answer' => '<p>1-60 minutes.</p>']);
		$this->db->insert('faqs', ['question' => 'What is the minimum amount for withdrawal and upgrade?', 'answer' => '<p>Minimum withdrawal amount is 50 {setting:currency_code}, 1-4 {setting:currency_code} transaction fee. Minimal upgrade amount is 300 {setting:currency_code}.</p>']);
		$this->db->insert('faqs', ['question' => 'I sent less than 300 {setting:currency_code}, what should I do?', 'answer' => '<p>You need to send the remaining amount to the same address.</p>']);
		$this->db->insert('faqs', ['question' => 'If I pay for an upgrade how long is it active?', 'answer' => '<p>{setting:sitename} upgrades works for 30 days.</p>']);
		$this->db->insert('faqs', ['question' => 'Can I upgrade <strong>{setting:sitename}</strong> with money on my balance?', 'answer' => '<p>No.</p>']);
		$this->db->insert('faqs', ['question' => 'Is there a lifetime of my account?', 'answer' => '<p>Yes, the account is deleted if there was no activity on it for 30 days.</p>']);
		$this->db->insert('faqs', ['question' => 'Can I buy more than one miner?', 'answer' => '<p>Yes, of course, you can buy any number of miners, their power is summed.</p>']);
		$this->db->insert('faqs', ['question' => 'How long does the contract last?', 'answer' => '<p>30 days from the date of purchase.</p>']);
		$this->db->insert('faqs', ['question' => 'Does it allowed to have multiple accounts?', 'answer' => '<p>Yes, you can have multiple wallets added to the system but they should not be registered using your referral link from another wallet. In case of violation of this prohibition your wallet will be banned without return your deposit/funds.</p>']);
		$this->db->insert('faqs', ['question' => 'I haven\'t found an answer to my question. How can I get in touch with you?', 'answer' => '<p>You can get in touch with us via our <a href="{url:contact}">contacts page</a>.</p>']);
	}

	public function down()
	{
		$this->dbforge->drop_table('faqs');
	}
}
