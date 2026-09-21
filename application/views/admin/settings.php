<?php
defined('BASEPATH') or exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="home.php">Home</a></li>
			<li class="breadcrumb-item active">Settings</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Settings</h1>
		</header>
		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-body">
						<h4>Cache Settings</h4>
						<p>Read the Cache section in the documentation to find out how to change the default cache setting if you want to change the duration of the database query cache.</p>
						<a href="<?php echo adminRoute('clearcache'); ?>" class="btn btn-danger"><i class="fa fa-trash"></i> Clear Cache Data</a>
					</div>
				</div>
				<form id="data-form" action="<?php echo adminRoute('settings'); ?>" method="POST">
					<div class="card">
						<div class="card-body">
							<h4>General Settings</h4>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="sitename">Site Name</label>
										<input type="text" class="form-control" name="sitename" id="sitename"
											   value="<?php echo $item['sitename']; ?>" placeholder="Name of your site"
											   required>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="siteslogan">Site Slogan</label>
										<input type="text" class="form-control" name="siteslogan" id="siteslogan"
											   value="<?php echo $item['siteslogan']; ?>" placeholder="Slogan of your site"
											   required>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="keywords">Site Keywords</label>
										<input type="text" class="form-control" name="keywords" id="keywords"
											   value="<?php echo $item['keywords']; ?>"
											   placeholder="Keywords of your site, separated with comma" required>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="description">Site Description</label>
										<input type="text" class="form-control" name="description" id="description"
											   value="<?php echo $item['description']; ?>"
											   placeholder="Description of your site" required>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="header_codes">Header Codes</label>
										<textarea class="form-control" name="header_codes" id="header_codes" rows="10" placeholder="Add html code inside your website's HEAD tag"><?php echo $item['header_codes']; ?></textarea>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="footer_codes">Footer Codes</label>
										<textarea class="form-control" name="footer_codes" id="footer_codes" rows="10" placeholder="Add html code at the end of your site (before the &lt;/body&gt; tag)"><?php echo $item['footer_codes']; ?></textarea>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>Layout Settings</h4>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="theme">Active Theme</label>
										<select class="form-control" name="theme" id="theme">
											<option value="">-- SELECT --</option>
											<?php
											$themes = getThemes();
											foreach ($themes as $burl):
												if ($burl == $item['theme']):
													$bSel = 'selected';
												else:
													$bSel = '';
												endif;
												echo '<option value="' . $burl . '" ' . $bSel . '>' . ucfirst($burl) . '</option>';
											endforeach;
											?>
										</select>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="pagination">Admin Pagination</label>
										<input type="number" step="1" class="form-control" name="pagination" id="pagination"
											   value="<?php echo $item['pagination']; ?>"
											   placeholder="Items per page on admin" required>
									</div>
								</div>
							</div>
							<h5>Project Start Date</h5>
							<div class="row">
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="show_start_date">Show Start Date</label>
										<select name="show_start_date" id="show_start_date" class="form-control" required>
											<option value="">-- Select --</option>
											<option value="yes" <?php echo ($item['show_start_date'] === 'yes') ? 'selected' : ''; ?>>
												Yes
											</option>
											<option value="no" <?php echo ($item['show_start_date'] === 'no') ? 'selected' : ''; ?>>
												No
											</option>
										</select>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="start_date">Start Date</label>
										<input type="date" class="form-control" name="start_date" id="start_date"
											   value="<?php echo $item['start_date']; ?>"
											   placeholder="When the site went live" required>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="start_date_increment">Add Days</label>
										<div class="input-group">
											<input type="number" step="1" min="0" class="form-control"
												   name="start_date_increment" id="start_date_increment"
												   value="<?php echo $item['start_date_increment']; ?>"
												   placeholder="Add days to start date" required>
											<div class="input-group-append">
												<span class="input-group-text">days</span>
											</div>
										</div>
										<small class="help-block text-muted">Add days to the counter</small>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>Social Settings</h4>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="facebook">Facebook</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><i class="fa fa-external-link"></i></span>
											</div>
											<input type="url" class="form-control" name="facebook"id="facebook"
												   value="<?php echo $item['facebook']; ?>"
												   placeholder="Facebook Page or Group URL">
										</div>
										<small class="help-block text-muted">Leave blank to deactivate</small>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="telegram">Telegram</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><i class="fa fa-external-link"></i></span>
											</div>
											<input type="url" class="form-control" name="telegram" id="telegram"
												   value="<?php echo $item['telegram']; ?>"
												   placeholder="Telegram Group or Channel URL">
										</div>
										<small class="help-block text-muted">Leave blank to deactivate</small>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="twitter">Twitter</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><i class="fa fa-external-link"></i></span>
											</div>
											<input type="url" class="form-control" name="twitter" id="twitter"
												   value="<?php echo $item['twitter']; ?>"
												   placeholder="Twitter Profile URL">
										</div>
										<small class="help-block text-muted">Leave blank to deactivate</small>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="vk">VK</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><i class="fa fa-external-link"></i></span>
											</div>
											<input type="url" class="form-control" name="vk" id="vk"
												   value="<?php echo $item['vk']; ?>" placeholder="VK Page or Group URL">
										</div>
										<small class="help-block text-muted">Leave blank to deactivate</small>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>Limit Settings</h4>
							<div class="row">
								<div class="col-md-6">
									<label for="min_withdraw">Min. Withdrawal</label>
									<div class="input-group">
										<input type="text" class="form-control" name="min_withdraw" id="min_withdraw"
											   value="<?php echo $item['min_withdraw']; ?>"
											   placeholder="Min withdraw value" required>
										<div class="input-group-append"><span
													class="input-group-text"><?php echo $item['currency_code']; ?></span>
										</div>
									</div>
								</div>
								<div class="col-md-6">
									<label for="max_withdraw">Max. Withdrawal</label>
									<div class="input-group">
										<input type="text" class="form-control" name="max_withdraw" id="max_withdraw"
											   value="<?php echo $item['max_withdraw']; ?>"
											   placeholder="Max withdraw value" required>
										<div class="input-group-append"><span
													class="input-group-text"><?php echo $item['currency_code']; ?></span>
										</div>
									</div>
								</div>
							</div>
							<br>
							<div class="row">
								<div class="col-md-6">
									<label for="aff_comission">Affiliate Commission</label>
									<div class="input-group">
										<input type="text" class="form-control" name="aff_comission" id="aff_comission"
											   value="<?php echo $item['aff_comission']; ?>"
											   placeholder="Affiliate commission percentage" required>
										<div class="input-group-append"><span class="input-group-text">%</span></div>
									</div>
								</div>
								<div class="col-md-6">
									<label for="max_pending_transactions">Max Pending Transactions(per user)</label>
									<div class="input-group">
										<input type="number" step="1" min="1" class="form-control"
											   name="max_pending_transactions" id="max_pending_transactions"
											   value="<?php echo $item['max_pending_transactions']; ?>"
											   placeholder="Min withdraw value affiliate commissions" required>
										<div class="input-group-append"><span class="input-group-text"><i
														class="fa fa-spinner"></i></span></div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>Currency Settings</h4>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="currency_name">Currency Name</label>
										<input type="text" class="form-control" name="currency_name" id="currency_name"
											   value="<?php echo $item['currency_name']; ?>"
											   placeholder="Currency name. Dogecoin, Bitcoin, Litecoin, Ethereum"
											   required>
										<small class="help-block text-muted">Currency name. Eg: Dogecoin</small>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="currency_code">Currency Code</label>
										<input type="text" class="form-control" name="currency_code" id="currency_code"
											   value="<?php echo $item['currency_code']; ?>"
											   placeholder="Currency code. DOGE, BTC, LTC, ETH" required>
										<small class="help-block text-muted">Currency code. Eg: DOGE</small>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="currency_symbol">Currency Symbol</label>
										<input type="text" class="form-control" name="currency_symbol" id="currency_symbol"
											   value="<?php echo $item['currency_symbol']; ?>"
											   placeholder="Currency symbol. Đ, Ƀ, Ł, Ξ" required>
										<small class="help-block text-muted">Examples: Đ, Ƀ, Ł, Ξ</small>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="currency_decimals">Decimals</label>
										<input type="number" class="form-control" name="currency_decimals" id="currency_decimals"
											   value="<?php echo $item['currency_decimals']; ?>"
											   placeholder="Number of decimals to show" required>
										<small class="help-block text-muted">Eg: 8 = 10.00000000</small>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="wallet_min">Wallet Address Min Characters</label>
										<input type="number" class="form-control" name="wallet_min" id="wallet_min"
											   value="<?php echo $item['wallet_min']; ?>"
											   placeholder="Min Characters for Wallet Address Validation" required>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="wallet_max">Wallet Address Max Characters</label>
										<input type="number" class="form-control" name="wallet_max" id="wallet_max"
											   value="<?php echo $item['wallet_max']; ?>"
											   placeholder="Max Characters for Wallet Address Validation" required>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-12">
									<div class="form-group">
										<label for="blockchain">Blockchain Tracking URL</label>
										<select class="form-control" name="blockchain" id="blockchain">
											<option value="">-- SELECT --</option>
											<option value="0" <?php echo ($item['blockchain'] === '0') ? 'selected' : ''; ?>>
												! DISABLED !
											</option>
											<?php
											foreach ($urlchains as $burl):
												if ($burl['id'] == $item['blockchain']):
													$bSel = 'selected';
												else:
													$bSel = '';
												endif;
												echo '<option value="' . $burl['id'] . '" ' . $bSel . '>' . $burl['name'] . '</option>';
											endforeach;
											?>
										</select>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>CoinPayments Settings <a href="https://www.coinpayments.net/?ref=c69dfbdb0d8eedb2d5e7180b85d1e0b9" title="Register on Coinpayments"><i class="fa fa-external-link"></i></a></h4>
							<div class="row">
								<div class="col-md-6">
									<div class="form-group">
										<label for="coin_cur1">Site Currency</label>
										<input type="text" class="form-control" name="coin_cur1" id="coin_cur1"
											   value="<?php echo $item['coin_cur1']; ?>"
											   placeholder="Currency used in your site" required>
										<small class="help-block text-muted">See the list of codes here <a
													href="https://www.coinpayments.net/supported-coins-all"
													target="_blank">here</a>. <strong class="text-danger">Pay attention to uppercase, lowercase and dots.</strong></small>
									</div>
								</div>
								<div class="col-md-6">
									<div class="form-group">
										<label for="coin_cur2">Receive Currency</label>
										<input type="text" class="form-control" name="coin_cur2" id="coin_cur2"
											   value="<?php echo $item['coin_cur2']; ?>"
											   placeholder="Currency used to receive payments" required>
										<small class="help-block text-muted">See the list of codes here <a
													href="https://www.coinpayments.net/supported-coins-all"
													target="_blank">here</a>. <strong class="text-danger">Pay attention to uppercase, lowercase and dots.</strong></small>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="coin_hash">Security Hash</label>
										<input type="text" class="form-control" name="coin_hash" id="coin_hash"
											   value="<?php echo $item['coin_hash']; ?>"
											   placeholder="Create a secure hash to validate transactions" required>
										<small class="help-block text-muted">Your security hash to encrypt transactions.</small>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="coin_mode">Payment Mode</label>
										<select name="coin_mode" id="coin_mode" class="form-control" required>
											<option value="api" <?php echo ($item['coin_mode'] === 'api') ? 'selected' : ''; ?>>
												API
											</option>
											<option value="gateway" <?php echo ($item['coin_mode'] === 'gateway') ? 'selected' : ''; ?>>
												Gateway
											</option>
										</select>
										<small class="help-block text-muted">API= Generate Payment Address+QRCode. Gateway =
											redirect user to Coinpayments.</small>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="coin_email">Invoice Email</label>
										<select name="coin_email" id="coin_email" class="form-control" required>
											<option value="user" <?php echo ($item['coin_email'] === 'user') ? 'selected' : ''; ?>>
												User(default)
											</option>
											<option value="admin" <?php echo ($item['coin_email'] === 'admin') ? 'selected' : ''; ?>>
												Admin
											</option>
										</select>
										<small class="help-block text-muted">Use the user or <a href="#smtp_sender">SMTP Sender Email</a> to create payment addresses and make payments.</small>
									</div>
								</div>
							</div>
						</div>
					</div>

					<div class="card">
						<div class="card-body">
							<h4>Email Settings</h4>
							<div class="row">
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_host">SMTP Host (Outgoing)</label>
										<input type="text" class="form-control" name="smtp_host" id="smtp_host"
											   value="<?php echo $item['smtp_host']; ?>" placeholder="SMTP Hostname"
											   required>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_port">SMTP Port</label>
										<input type="text" class="form-control" name="smtp_port" id="smtp_port"
											   value="<?php echo $item['smtp_port']; ?>" placeholder="SMTP Port Number"
											   required>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_secure">SMTP Secure</label>
										<select name="smtp_secure" id="smtp_secure" class="form-control" required>
											<option value="null" <?php echo ($item['smtp_secure'] === 'null') ? 'selected' : ''; ?>>
												None
											</option>
											<option value="ssl" <?php echo ($item['smtp_secure'] === 'ssl') ? 'selected' : ''; ?>>
												SSL
											</option>
											<option value="tsl" <?php echo ($item['smtp_secure'] === 'tsl') ? 'selected' : ''; ?>>
												TSL
											</option>
										</select>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_user">SMTP Username</label>
										<input type="text" class="form-control" name="smtp_user" id="smtp_user"
											   value="<?php echo $item['smtp_user']; ?>" placeholder="SMTP username"
											   required>
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_pass">SMTP Password</label>
										<input type="password" class="form-control" name="smtp_pass" id="smtp_pass"
											   placeholder="Leave blank to dont change">
									</div>
								</div>
								<div class="col-md-4">
									<div class="form-group">
										<label for="smtp_sender">SMTP Sender Email</label>
										<input type="text" class="form-control" name="smtp_sender" id="smtp_sender"
											   value="<?php echo $item['smtp_sender']; ?>"
											   placeholder="SMTP sender email" required>
									</div>
								</div>
								<br>
							</div>
						</div>
					</div>
					<button type="submit" class="btn btn-success"><i class="fa fa-save"></i> Save</button>
				</form>
			</div>
		</div>
	</div>
</section>
