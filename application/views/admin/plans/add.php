<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item"><a href="<?php echo adminRoute('plans');?>">Plans Management</a></li>
			<li class="breadcrumb-item active">Add Plan</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Add Plan</h1>
		</header>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-body">
						<form action="<?php adminRoute('plans/add'); ?>" method="POST">
							<div class="row">
								<div class="col-lg-6 col-sm-12">
									<div class="form-group">
										<label for="plan_name">Plan Name</label>
										<input type="text" class="form-control" name="plan_name" id="plan_name" placeholder="Plan name" value="<?php echo set_value('plan_name'); ?>" required>
									</div>
								</div>
								<div class="col-lg-6 col-sm-12">
									<div class="form-control-label">
										<label for="is_default">Is default(Free)</label>
									</div>
									<div class="custom-control-inline">
										<div class="i-checks">
											<input id="is_default1" type="radio" value="1" name="is_default" class="form-control-custom radio-custom">
											<label for="is_default1">Yes</label>
										</div>
										<div class="i-checks">
											<input id="is_default0" type="radio" value="0" name="is_default" class="form-control-custom radio-custom">
											<label for="is_default0">No</label>
										</div>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="plan_price">Plan Price</label>
										<div class="input-group">
											<input type="text" id="plan_price" class="form-control" name="price" placeholder="Plan Price" value="<?php echo set_value('price'); ?>" required>
											<div class="input-group-append">
												<span class="input-group-text"><?php echo settings('currency_code');?></span>
											</div>
										</div>
										<small class="help-block text-muted">Plan purchase price</small>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="duration">Plan Duration (days)</label>
										<div class="input-group">
											<input type="number" min="0" id="duration" class="form-control" name="duration" placeholder="Plan duration (days)" value="<?php echo set_value('duration'); ?>" required>
											<div class="input-group-append">
												<span class="input-group-text">days</span>
											</div>
										</div>
										<small class="help-block text-muted">How many days does the plan last</small>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="earning_rate">Earning Rate (min)</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><?php echo settings('currency_code');?></span>
											</div>
											<input type="text" id="earning_rate" class="form-control" name="earning_rate" placeholder="Coins per minute" value="<?php echo set_value('earning_rate'); ?>" required>
											<div class="input-group-append">
												<span class="input-group-text">min</span>
											</div>
										</div>
										<small class="help-block text-muted">How many coins are mined per minute</small>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="version">Version</label>
										<input type="text" id="version" class="form-control" name="version" placeholder="Version name" value="<?php echo set_value('version'); ?>" required>
										<small class="help-block text-muted">Purely illustrative value</small>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="point_per_day">Coin per day</label>
										<div class="input-group">
											<div class="input-group-prepend">
												<span class="input-group-text"><?php echo settings('currency_code');?></span>
											</div>
											<input type="text" id="point_per_day" class="form-control" name="point_per_day" placeholder="Coins per day" value="<?php echo set_value('point_per_day'); ?>" required>
											<div class="input-group-append">
												<span class="input-group-text">day</span>
											</div>
										</div>
										<small class="help-block text-muted">Purely illustrative value</small>
									</div>
								</div>
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="profit">Plan Profit (%)</label>
										<div class="input-group">
											<input type="number" step="any" id="profit" class="form-control" name="profit" placeholder="Examples: 2 | 5.25" value="<?php echo set_value('profit'); ?>" required>
											<div class="input-group-append">
												<span class="input-group-text">%</span>
											</div>
										</div>
										<small class="help-block text-muted">Purely illustrative value</small>
									</div>
								</div>
							</div>
							<div class="row">
								<div class="col-lg-4 col-sm-12">
									<div class="form-group">
										<label for="speed">Mining Speed</label>
										<input type="number" step="any" id="speed" class="form-control" name="speed" placeholder="Mining Speed" value="<?php echo set_value('speed'); ?>" required>
										<small class="help-block text-muted">Purely illustrative value</small>
									</div>
								</div>
								<div class="col-lg-8 col-sm-12">
									<div class="form-group">
										<label for="image">Image File Name</label>
										<select class="form-control" name="image" id="image">
											<option value="">-- SELECT A OPTION --</option>
											<?php
											$imgsArray = getPlansImages();
											foreach($imgsArray as $pimg){
												echo '<option value="'.$pimg.'">'.$pimg.'</option>';
											}
											?>
										</select>
										<span class="help-block text-muted">You need upload the image in your hosting account or via FTP on <b>assets/plans</b> folder</span>
									</div>
								</div>
							</div>
							<button type="submit" class="btn btn-success"><i class="fa fa-save"></i> Create</button>
						</form>
					</div>
				</div>
			</div>
		</div>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						Profit Calculator
						<div class="pull-right clearfix">
							<a href="javascript:void(0);" onclick="calculateProfit()" class="btn btn-success btn-sm" title="Calculate Profit"><i class="fa fa-calculator"></i> Calculate</a>
						</div>
					</div>
					<div class="card-body">
						<div class="table-responsive">
							<table class="table table-dark">
								<thead>
								<tr>
									<th>Hourly Profit</th>
									<th>Daily Profit</th>
									<th>Weekly Profit</th>
									<th>Monthly Profit</th>
									<th>Total Profit</th>
								</tr>
								</thead>
								<tbody>
								<tr>
									<td><?php echo settings('currency_symbol'); ?> <span id="hourlyProfit">0</span></td>
									<td><?php echo settings('currency_symbol'); ?> <span id="dailyProfit">0</span></td>
									<td><?php echo settings('currency_symbol'); ?> <span id="weeklyProfit">0</span></td>
									<td><?php echo settings('currency_symbol'); ?> <span id="monthlyProfit">0</span></td>
									<td><?php echo settings('currency_symbol'); ?> <span id="totalProfit">0</span></td>
								</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
