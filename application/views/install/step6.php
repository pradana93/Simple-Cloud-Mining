<div class="card-header">
	Installation Finished
</div>
<div class="card-body">
	<?php include_once 'includes/alerts.php';?>
	<form action="<?php echo installRoute('install/step6');?>" method="post" id="formStep">
		<input type="hidden" name="finish" value="true">
		<div class="alert alert-danger">Click on button bellow to finish installation, remove installation urls and go to your site. Maintaining installation urls may cause a reinstallation of the database and consequently data loss.</div>
	</form>
</div>
<div class="card-footer">
	<button class="btn btn-info" onclick="(this).classList.add('disabled');(this).innerHTML='Working...<i class=\'fa fa-spinner fa-spin\'></i>';document.getElementById('formStep').submit();">Remove Installation Routes and go to Admin</button>
</div>
