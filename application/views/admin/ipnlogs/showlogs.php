<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="<?php echo adminRoute();?>">Home</a></li>
			<li class="breadcrumb-item active">Log Viewer</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Log Viewer</h1>
		</header>

		<div class="row">
			<div class="col-lg-12">
				<iframe src="<?php echo adminRoute('error_logs_list'); ?>" frameborder="0" style="overflow: hidden" onload="this.style.height=(this.contentWindow.document.body.scrollHeight+20)+'px';" width="100%"></iframe>
			</div>			
		</div>
	</div>
</section>
