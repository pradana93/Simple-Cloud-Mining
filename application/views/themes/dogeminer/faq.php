    <div class="container">
        <div class="input-mine">
		<h1>Frequently Asked Questions</h1>
		<p>Have a question? We are here to help you!</p>
            <div class="text-center" style="margin-bottom: 10px">
				<?php include_once __DIR__ . '/includes/social.php'; ?>
            </div>
        </div>
    </div>
</div>

	<div class="wrapper white-box">
		<div class="container">
			<div class="faq-box">
				<?php
				foreach($faqs as $faq):
					?>
					<div class="faq-item">
						<h2><?php echo htmlspecialchars_decode(parse_text_codes($faq['question'])); ?></h2>
						<?php echo htmlspecialchars_decode(parse_text_codes($faq['answer'])); ?>
					</div>
				<?php
				endforeach;
				?>
				<div class="clearfix"></div>
			</div>
		</div>
	</div>
