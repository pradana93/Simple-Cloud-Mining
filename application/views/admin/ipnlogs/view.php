<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item"><a href="<?php echo adminRoute('ipnlogs');?>">IPN Logs</a></li>
			<li class="breadcrumb-item active">IPN Log Details</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">IPN Log Details</h1>
		</header>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						<h3>Basic Details</h3>
					</div>
					<div class="card-body">
						<dl class="row">
							<dt class="col-sm-6">Date</dt>
							<dd class="col-sm-6"><?php echo $item['created_at'];?></dd>
							<dt class="col-sm-6">Status</dt>
							<dd class="col-sm-6"><?php echo $item['status'];?></dd>
							<dt class="col-sm-6">Error Message</dt>
							<dd class="col-sm-6"><?php echo $item['message'];?></dd>
							<dt class="col-sm-6">Params(for debug)</dt>
						</dl>
						<textarea class="form-control" rows="15" readonly><?php echo json_decode($item['content']);?></textarea>
					</div>
				</div>
			</div>
		</div>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						<h3>Transaction Details</h3>
					</div>
					<div class="card-body">
						<dl class="row">
							<dt class="col-sm-6">ID</dt>
							<dd class="col-sm-6"><?php echo $transaction['id'];?></dd>
							<dt class="col-sm-6">User ID</dt>
							<dd class="col-sm-6"><a href="<?php echo adminRoute('users/view/'.$transaction['user_id']);?>"><?php echo $transaction['user_id'];?></a></dd>
							<dt class="col-sm-6">Plan ID</dt>
							<dd class="col-sm-6"><a href="<?php echo adminRoute('plans/edit/'.$transaction['plan_id']);?>"><?php echo $transaction['plan_id'];?></a></dd>
							<dt class="col-sm-6">Amount</dt>
							<dd class="col-sm-6"><?php echo $transaction['amount'];?></dd>
							<dt class="col-sm-6">Hash/Invoice</dt>
							<dd class="col-sm-6"><?php echo $transaction['hash'];?></dd>
							<dt class="col-sm-6">Date</dt>
							<dd class="col-sm-6"><?php echo $transaction['date'];?></dd>
							<dt class="col-sm-6">Params(for debug)</dt>
						</dl>
						<textarea class="form-control" rows="15" readonly><?php echo $transaction['params'];?></textarea>
					</div>
				</div>
			</div>
		</div>

	</div>
</section>
