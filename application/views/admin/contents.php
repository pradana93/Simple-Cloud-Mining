<?php
defined('BASEPATH') or exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="home.php">Home</a></li>
			<li class="breadcrumb-item active">Contents</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Contents</h1>
		</header>
		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<form id="data-form" action="<?php echo adminRoute('contents'); ?>" method="POST">
					<div class="card">
						<div class="card-body">
							<h4>Page Contents</h4>
							<p>Manage the fixed texts of some pages of the site. You can use HTML code to format the texts, and also use the Codes listed below to generate internal links and obtain site settings to use in the content of each page.</p>
							<p>Available Codes(settings):
							<code>
								<?php
								foreach($codes as $code) {
									if($code!=='id') {
										echo $code.', ';
									}
								}
								?>
							</code>
							</p>
							<p>Available Codes:</p>
							<div class="table-responsive">
								<table class="table table-striped">
									<thead>
									<tr>
										<th>Code</th>
										<th>Description</th>
										<th>Example Code</th>
										<th>Example Output</th>
									</tr>
									</thead>
									<tbody>
									<tr>
										<td>{setting:}</td>
										<td>Get site settings</td>
										<td>{setting:sitename}</td>
										<td><?=settings('sitename');?></td>
									</tr>
									<tr>
										<td>{url:}</td>
										<td>Generate internal links</td>
										<td>{url:payouts}</td>
										<td><?=base_url('payouts');?></td>
									</tr>
									</tbody>
								</table>
							</div>
							<div class="form-group">
								<label for="affiliate">Affiliate Program</label>
								<textarea name="affiliate" id="affiliate" class="form-control" rows="10" placeholder="Affiliate Program page text"
										  required><?php echo $item['affiliate']; ?></textarea>
							</div>
							<div class="form-group">
								<label for="payouts">Payouts</label>
								<textarea name="payouts" id="payouts" class="form-control" rows="10" placeholder="Payouts page text"
										  required><?php echo $item['payouts']; ?></textarea>
							</div>
							<div class="form-group">
								<label for="contact">Contact Us</label>
								<textarea name="contact" id="contact" class="form-control" rows="10" placeholder="Contact page text"
										  required><?php echo $item['contact']; ?></textarea>
							</div>
						</div>
					</div>
					<button type="submit" class="btn btn-success"><i class="fa fa-save"></i> Save</button>
				</form>
			</div>
		</div>
	</div>
</section>
