<?php
defined('BASEPATH') OR exit('No direct script access allowed');
?>
<footer class="main-footer">
	<div class="container-fluid">
		<div class="row">
			<div class="col-sm-6">
				<p>&copy; All rights reserved. <?php echo SC_NAME.' v.'.SC_VERSION; ?> by <a href="//www.smartyscripts.com" target="_blank">SmartyScripts</a></p>
			</div>
			<div class="col-sm-6 text-right">
				<p>Design by <a href="https://bootstrapious.com" class="external" target="_blank">Bootstrapious</a></p>
				<!-- Please do not remove the backlink to us unless you support further theme's development at https://bootstrapious.com/donate. It is part of the license conditions and it helps me to run Bootstrapious. Thank you for understanding :)-->
			</div>
		</div>
	</div>
</footer>
</div><!-- /div page-->
<!-- JavaScript files-->
<script src="<?php echo adminAssets('vendor/jquery/jquery.min.js');?>"></script>
<script src="<?php echo adminAssets('vendor/popper.js/umd/popper.min.js');?>"> </script>
<script src="<?php echo adminAssets('vendor/bootstrap/js/bootstrap.min.js');?>"></script>
<script src="<?php echo adminAssets('js/grasp_mobile_progress_circle-1.0.0.min.js');?>"></script>
<script src="<?php echo adminAssets('vendor/jquery.cookie/jquery.cookie.js');?>"> </script>
<script src="<?php echo adminAssets('vendor/jquery-validation/jquery.validate.min.js');?>"></script>
<script src="<?php echo adminAssets('vendor/malihu-custom-scrollbar-plugin/jquery.mCustomScrollbar.concat.min.js');?>"></script>
<!-- Main File-->
<script src="<?php echo adminAssets('js/front.js');?>"></script>
<!--Profit calculator-->
<script>
	function calculateProfit()
	{
		let planPrice = parseFloat($('#plan_price').val()).toFixed(20);
		let planDuration = parseFloat($('#duration').val()).toFixed(0);
		let perMinute = parseFloat($('#earning_rate').val()).toFixed(20);
		let hourlyProfit = $('#hourlyProfit');
		let dailyProfit = $('#dailyProfit');
		let weeklyProfit = $('#weeklyProfit');
		let monthlyProfit = $('#monthlyProfit');
		let totalProfit = $('#totalProfit');
		let hourlyRate = perMinute * 60;
		let dailyRate = hourlyRate * 24;
		let weeklyRate = dailyRate * 7;
		let monthlyRate = dailyRate * 30;
		let totalRate = dailyRate * planDuration - planPrice;

		hourlyProfit.html(hourlyRate.toFixed(8));
		dailyProfit.html(dailyRate.toFixed(8));
		weeklyProfit.html(weeklyRate.toFixed(8));
		monthlyProfit.html(monthlyRate.toFixed(8));
		totalProfit.html(totalRate.toFixed(8));
	}
</script>
</body>
</html>
