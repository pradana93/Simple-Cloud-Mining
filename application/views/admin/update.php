<?php
defined('BASEPATH') or exit('No direct script access allowed');
?>
<!-- Breadcrumb-->
<div class="breadcrumb-holder">
	<div class="container-fluid">
		<ul class="breadcrumb">
			<li class="breadcrumb-item"><a href="home.php">Home</a></li>
			<li class="breadcrumb-item active">Update Script</li>
		</ul>
	</div>
</div>
<!-- /. ROW  -->
<section>
	<div class="container-fluid">
		<header>
			<?php $this->load->view('admin/includes/alerts'); ?>
			<h1 class="h3 display">Update Script</h1>
		</header>
		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						Check for updates
					</div>
					<div class="card-body">
						<p>Click the button below to check for a new version of the script.</p>
						<a href="<?php echo adminRoute('check_update'); ?>" class="btn btn-success"><i class="fa fa-refresh"></i> Check Update</a>
					</div>
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-sm-12 col-lg-12">
				<div class="card">
					<div class="card-header">
						Important Tips
					</div>
					<div class="card-body">
						<ol>
							<li>You can download update packages from the Downloads section of your account on the <a href="https://smartyscripts.com" target="_blank">Smarty Scripts</a> website.</li>
							<li>Before applying an Update Package, unzip the zip file and read the instructions contained in the <strong>[HOW TO UPDATE].txt</strong> file. This file contains important instructions that need to be followed in order for the update to work properly. <strong class="text-danger">FAILING TO FOLLOW THE INSTRUCTIONS IN THIS FILE MAY CAUSE ERRORS ON YOUR SITE</strong>.</li>
							<li>Only use Update Pack on an installation/domain/site that already has active users to prevent data from being erased/updated.</li>
							<li>If your script has just been installed and you do not have active users, it is recommended to delete everything and install the latest version of the script using the file that contains the installer(eg: SCM v1.0.1.zip).</li>
							<li>Remember to download only the update package(eg: SCM Patch v1.0.1.zip), don't try to update your website using the installer file(eg: SCM v1.0.1.zip), or your website may crash and you will need to reinstall again.</li>
							<li>Always apply one update package at a time, following ascending order from the current version of your script. Example: if you are using version 1.0.0 and there is an update to version 1.0.5, see if there are updates 1.0.1/1.0.2/1.0.3/1.0.4 and apply each one in ascending order, before applying version 1.0.5. The latest update packages do not contain previous updates, so you must apply each one separately.</li>
							<li>If you are using one of the official addons/themes, check if there is a new version of them compatible with your version of SCM</li>
						</ol>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
