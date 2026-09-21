<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item"><a href="<?php echo adminRoute('withdrawals-history');?>">Withdrawal History</a></li>
			<li class="breadcrumb-item active">View Withdrawal Details</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">View Withdrawal Details</h1>
		</header>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-body">
						<dl class="row">
							<dt class="col-sm-6">User Wallet</dt>
							<dd class="col-sm-6"><a href="<?php echo adminRoute('users/edit/'.$item['user_id']);?>"><?php echo $item['username'];?></a></dd>
							<dt class="col-sm-6">Type</dt>
							<dd class="col-sm-6"><?php echo ucfirst($item['type']);?></dd>
							<dt class="col-sm-6">Amount</dt>
							<dd class="col-sm-6"><?php echo settings('currency_symbol'); ?> <?php echo $item['amount'];?></dd>
							<dt class="col-sm-6">Status</dt>
							<dd class="col-sm-6">
								<?php
								if($item['status']==='SUCCESS'){
									echo "<span class='badge badge-success'>".ucfirst($item['status'])."</span>";
								}
								if($item['status']==='PENDING'){
									echo "<span class='badge badge-warning'>".ucfirst($item['status'])."</span>";
								}
								if($item['status']==='PROCESSING'){
									echo "<span class='badge badge-info'>".ucfirst($item['status'])."</span>";
								}
								if($item['status']==='CANCELED'){
									echo "<span class='badge badge-danger'>".ucfirst($item['status'])."</span>";
								}
								?>
							</dd>
							<dt class="col-sm-6">Created At</dt>
							<dd class="col-sm-6"><?php echo $item['created_at'];?></dd>
							<dt class="col-sm-6">Paid At</dt>
							<dd class="col-sm-6"><?php echo $item['date_paid'];?></dd>
							<dt class="col-sm-6">TXID</dt>
							<dd class="col-sm-6"><a href="<?php echo blockchainUrl($item['tx']);?>" target="_blank"><?php echo $item['tx'];?></a></dd>
						</dl>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
