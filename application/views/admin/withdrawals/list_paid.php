<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item active">Withdrawals History</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Withdrawals History</h1>
		</header>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						Withdrawals History
					</div>
					<div class="card-body">
						<div class="table-responsive">
							<table class="table table-striped table-bordered table-hover">
								<thead>
								<tr>
									<th>#</th>
									<th>User Wallet</th>
									<th>Type</th>
									<th>Amount</th>
									<th>Status</th>
									<th>Date</th>
									<th>TXID</th>
									<th>Actions</th>
								</tr>
								</thead>
								<tbody>
								<?php if ($items): ?>
									<?php foreach ($items as $item): ?>
										<tr>
										<td><?php echo $item['id']; ?></td>
										<td><a href="<?php echo adminRoute('users/view/'.$item['user_id']);?>"><?php echo $item['username']; ?></a></td>
										<td><?php echo ucfirst($item['type']); ?></td>
										<td><?php echo settings('currency_symbol'); ?> <?php echo $item['amount']; ?></td>
										<td>
											<?php echo "<span class='badge badge-success'>".ucfirst($item['status'])."</span>"; ?>
										</td>
										<td><?php echo $item['created_at']; ?></td>
										<td><a href="<?php echo blockchainUrl($item['tx']); ?>" target="_blank"><?php echo $item['tx']; ?></a></td>
										<td>
											<a class="btn btn-xs btn-info" href="<?php echo adminRoute('withdrawals-history/view/'.$item['id']); ?>"><i class="fa fa-eye"></i> View</a>
										</td>
										</tr>
									<?php endforeach; ?>
								<?php else: ?>
									<tr>
										<td colspan="8" class="text-center">No results</td>
									</tr>
								<?php endif; ?>
								</tbody>
							</table>
						</div>
					</div>
					<?php if($pagination_links): ?>
					<div class="card-footer">
						<div class="pull-left"><?php echo $pagination_links; ?></div>
						<div class="pull-right clearfix"><small>Total results: <?php echo $total_items; ?></small></div>
					</div>
					<?php endif; ?>
				</div>
			</div>
		</div>
	</div>
</section>
