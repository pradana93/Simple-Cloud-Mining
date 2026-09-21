<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item"><a href="<?php echo adminRoute('faqs');?>">F.A.Q.s</a></li>
			<li class="breadcrumb-item active">Add F.A.Q.</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Add F.A.Q.</h1>
		</header>

		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-body">
						<form action="<?php adminRoute('faqs/add'); ?>" method="POST">
							<div class="form-group">
								<label for="question">Question</label>
								<input type="text" class="form-control" name="question" id="question" placeholder="Question" value="<?php echo set_value('question'); ?>" required>
							</div>
							<div class="form-group">
								<label for="answer">Answer</label>
								<textarea name="answer" id="answer" class="form-control" rows="10" placeholder="Answer"
										  required><?php echo set_value('answer'); ?></textarea>
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
					<div class="card-body">
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
					</div>
				</div>
			</div>
		</div>

	</div>
</section>
