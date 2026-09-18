/* ==========================================================================
   FitLog — Food & ingredient database
   Every row is per 100 g (or per 100 ml for liquids) of the RAW / as-listed
   state noted in the name.  Values are rounded reference figures drawn from
   standard composition tables (USDA FoodData Central style) and are intended
   for day-to-day logging, not clinical work.

   Row format:  name | category | kcal | protein | carbs | fat | fibre | servings
   servings:    label:grams;label:grams      (first one is the default)
   ========================================================================== */

const FOOD_RAW = `
Chicken Breast, skinless raw|Protein|120|22.5|0|2.6|0|100 g:100;1 fillet:150;1 kg:1000
Chicken Breast, grilled|Protein|165|31|0|3.6|0|1 fillet:150;100 g:100
Chicken Thigh, skinless raw|Protein|144|18.6|0|7.4|0|1 thigh:95;100 g:100
Chicken Whole, roasted with skin|Protein|239|27.3|0|13.6|0|100 g:100
Chicken Mince / Keema|Protein|143|20|0|7|0|100 g:100
Turkey Breast, raw|Protein|111|24|0|1.2|0|100 g:100
Beef Mince 90/10, raw|Protein|176|20|0|10|0|100 g:100
Beef Mince 80/20, raw|Protein|254|17.2|0|20|0|100 g:100
Beef Steak, sirloin raw|Protein|150|22|0|6.8|0|1 steak:200;100 g:100
Beef Steak, ribeye raw|Protein|240|21|0|17|0|1 steak:250;100 g:100
Lamb Leg, raw|Protein|201|20|0|13|0|100 g:100
Lamb Chops, raw|Protein|282|17|0|23|0|1 chop:90;100 g:100
Mutton, lean raw|Protein|190|21|0|11|0|100 g:100
Pork Loin, raw|Protein|143|21|0|6|0|100 g:100
Camel Meat, lean raw|Protein|160|22|0|7.5|0|100 g:100
Egg, whole raw|Dairy & Eggs|143|12.6|0.7|9.5|0|1 large egg:50;1 medium egg:44;100 g:100
Egg White|Dairy & Eggs|52|10.9|0.7|0.2|0|1 white:33;100 g:100
Egg Yolk|Dairy & Eggs|322|15.9|3.6|26.5|0|1 yolk:17;100 g:100
Salmon, raw|Protein|208|20.4|0|13.4|0|1 fillet:150;100 g:100
Tuna, fresh raw|Protein|132|28|0|1.3|0|100 g:100
Tuna, canned in water drained|Protein|116|26|0|0.8|0|1 can:95;100 g:100
Tuna, canned in oil drained|Protein|186|25|0|8.2|0|1 can:95;100 g:100
Cod / White Fish, raw|Protein|82|18|0|0.7|0|1 fillet:150;100 g:100
Hammour / Grouper, raw|Protein|92|19.4|0|1|0|1 fillet:150;100 g:100
Kingfish / Sheri, raw|Protein|110|21|0|2.5|0|100 g:100
Sardines, canned in oil|Protein|208|25|0|11.5|0|1 can:90;100 g:100
Mackerel, raw|Protein|205|19|0|13.9|0|100 g:100
Prawns / Shrimp, raw|Protein|85|20|0|0.5|0|100 g:100
Squid / Calamari, raw|Protein|92|15.6|3.1|1.4|0|100 g:100
Crab Meat|Protein|87|18|0|1.1|0|100 g:100
Milk, whole 3.5%|Dairy & Eggs|61|3.2|4.8|3.3|0|1 cup:244;100 ml:100
Milk, semi-skimmed 2%|Dairy & Eggs|50|3.3|4.8|2|0|1 cup:244;100 ml:100
Milk, skimmed|Dairy & Eggs|34|3.4|5|0.1|0|1 cup:244;100 ml:100
Laban / Buttermilk|Dairy & Eggs|40|3.3|4.8|0.9|0|1 cup:240;100 ml:100
Greek Yogurt, 0% fat|Dairy & Eggs|59|10|3.6|0.4|0|1 pot:170;100 g:100
Greek Yogurt, 2% fat|Dairy & Eggs|73|9.9|3.9|1.9|0|1 pot:170;100 g:100
Yogurt, plain full fat|Dairy & Eggs|61|3.5|4.7|3.3|0|1 cup:245;100 g:100
Labneh|Dairy & Eggs|174|8|5|14|0|1 tbsp:30;100 g:100
Cottage Cheese, low fat|Dairy & Eggs|72|12.4|2.7|1|0|1 cup:226;100 g:100
Cheddar Cheese|Dairy & Eggs|403|25|1.3|33|0|1 slice:28;100 g:100
Mozzarella, part skim|Dairy & Eggs|254|24.3|2.8|15.9|0|1 slice:28;100 g:100
Halloumi|Dairy & Eggs|321|22|2.2|25|0|1 slice:35;100 g:100
Feta Cheese|Dairy & Eggs|264|14.2|4.1|21.3|0|100 g:100
Paneer|Indian|265|18|3.6|20|0|100 g:100
Cream Cheese|Dairy & Eggs|342|6|4.1|34|0|1 tbsp:15;100 g:100
Butter|Fats & Oils|717|0.9|0.1|81|0|1 tbsp:14;1 tsp:5;100 g:100
Ghee|Fats & Oils|900|0|0|100|0|1 tbsp:14;1 tsp:5;100 g:100
Olive Oil|Fats & Oils|884|0|0|100|0|1 tbsp:13.5;1 tsp:4.5;100 ml:100
Sunflower Oil|Fats & Oils|884|0|0|100|0|1 tbsp:13.5;100 ml:100
Coconut Oil|Fats & Oils|862|0|0|100|0|1 tbsp:13.5;100 ml:100
Mayonnaise, full fat|Fats & Oils|680|1|0.6|75|0|1 tbsp:14;100 g:100
Mayonnaise, light|Fats & Oils|330|0.8|9|32|0|1 tbsp:14;100 g:100
Rice, white raw|Grains & Starches|360|6.6|79|0.6|1.3|1 cup dry:185;100 g:100
Rice, white cooked|Grains & Starches|130|2.7|28|0.3|0.4|1 cup:158;100 g:100
Rice, brown raw|Grains & Starches|367|7.5|76|2.7|3.5|1 cup dry:190;100 g:100
Rice, brown cooked|Grains & Starches|123|2.7|26|1|1.6|1 cup:195;100 g:100
Basmati Rice, cooked|Grains & Starches|121|3|25|0.4|0.6|1 cup:158;100 g:100
Oats, rolled dry|Grains & Starches|379|13.2|67.7|6.5|10.1|1/2 cup:40;1 cup:80;100 g:100
Oats, cooked in water|Grains & Starches|71|2.5|12|1.5|1.7|1 bowl:234;100 g:100
Quinoa, dry|Grains & Starches|368|14.1|64.2|6.1|7|1/2 cup:85;100 g:100
Quinoa, cooked|Grains & Starches|120|4.4|21.3|1.9|2.8|1 cup:185;100 g:100
Bulgur, cooked|Grains & Starches|83|3.1|18.6|0.2|4.5|1 cup:182;100 g:100
Couscous, cooked|Grains & Starches|112|3.8|23.2|0.2|1.4|1 cup:157;100 g:100
Pasta, dry|Grains & Starches|371|13|75|1.5|3.2|100 g:100
Pasta, cooked|Grains & Starches|131|5|25|1.1|1.8|1 cup:140;100 g:100
Whole Wheat Pasta, cooked|Grains & Starches|124|5.3|26.5|0.5|4.5|1 cup:140;100 g:100
Bread, white|Grains & Starches|265|9|49|3.2|2.7|1 slice:30;100 g:100
Bread, whole wheat|Grains & Starches|247|13|41|3.4|7|1 slice:32;100 g:100
Bread, sourdough|Grains & Starches|256|11|48|1.9|2.4|1 slice:50;100 g:100
Arabic Bread / Pita, white|Middle Eastern|275|9.1|55.7|1.2|2.2|1 loaf:60;100 g:100
Arabic Bread, brown|Middle Eastern|265|9.8|51|2.2|6.3|1 loaf:60;100 g:100
Saj Bread / Markouk|Middle Eastern|280|9|57|1.5|2.5|1 piece:45;100 g:100
Roti / Chapati|Indian|297|11|46|7.5|4.9|1 roti:40;100 g:100
Naan|Indian|310|9|51|7.5|2.2|1 naan:90;100 g:100
Paratha, plain|Indian|330|7.5|45|13|3.5|1 paratha:60;100 g:100
Puri|Indian|420|7|48|22|3|1 puri:25;100 g:100
Dosa, plain|Indian|168|3.9|28|4.5|1.2|1 dosa:80;100 g:100
Idli|Indian|132|4.5|26|0.6|1|1 idli:40;100 g:100
Upma|Indian|170|4|24|6.5|2|1 bowl:150;100 g:100
Poha|Indian|180|3.5|32|4.5|1.5|1 bowl:150;100 g:100
Tortilla, flour|Grains & Starches|306|8.2|51.4|7.6|3.1|1 tortilla:45;100 g:100
Potato, raw|Vegetables|77|2|17|0.1|2.2|1 medium:173;100 g:100
Potato, boiled|Vegetables|87|1.9|20.1|0.1|1.8|1 medium:170;100 g:100
Sweet Potato, raw|Vegetables|86|1.6|20.1|0.1|3|1 medium:130;100 g:100
French Fries, deep fried|Fast Food|312|3.4|41|15|3.8|1 medium portion:117;100 g:100
Lentils / Dal, dry|Legumes|352|24.6|63|1.1|10.7|1 cup dry:192;100 g:100
Lentils, cooked|Legumes|116|9|20|0.4|7.9|1 cup:198;100 g:100
Chickpeas, dry|Legumes|364|19.3|61|6|17.4|1 cup dry:200;100 g:100
Chickpeas, canned drained|Legumes|139|7.3|22.9|2.6|6.4|1 can:240;100 g:100
Kidney Beans, cooked|Legumes|127|8.7|22.8|0.5|6.4|1 cup:177;100 g:100
Black Beans, cooked|Legumes|132|8.9|23.7|0.5|8.7|1 cup:172;100 g:100
Fava Beans / Foul, cooked|Middle Eastern|110|7.6|19.7|0.4|5.4|1 bowl:200;100 g:100
Green Peas|Vegetables|81|5.4|14.5|0.4|5.7|1 cup:145;100 g:100
Soybeans, cooked|Legumes|173|16.6|9.9|9|6|1 cup:172;100 g:100
Tofu, firm|Legumes|144|17.3|2.8|8.7|2.3|1 block:120;100 g:100
Tempeh|Legumes|192|20.3|7.6|10.8|0|100 g:100
Edamame|Legumes|121|11.9|8.9|5.2|5.2|1 cup:155;100 g:100
Broccoli, raw|Vegetables|34|2.8|6.6|0.4|2.6|1 cup:91;100 g:100
Cauliflower, raw|Vegetables|25|1.9|5|0.3|2|1 cup:107;100 g:100
Spinach, raw|Vegetables|23|2.9|3.6|0.4|2.2|1 cup:30;100 g:100
Kale, raw|Vegetables|49|4.3|8.8|0.9|3.6|1 cup:67;100 g:100
Lettuce, romaine|Vegetables|17|1.2|3.3|0.3|2.1|1 cup:47;100 g:100
Cabbage, raw|Vegetables|25|1.3|5.8|0.1|2.5|1 cup:89;100 g:100
Carrot, raw|Vegetables|41|0.9|9.6|0.2|2.8|1 medium:61;100 g:100
Tomato, raw|Vegetables|18|0.9|3.9|0.2|1.2|1 medium:123;100 g:100
Cucumber, raw|Vegetables|15|0.7|3.6|0.1|0.5|1 medium:200;100 g:100
Onion, raw|Vegetables|40|1.1|9.3|0.1|1.7|1 medium:110;100 g:100
Garlic, raw|Vegetables|149|6.4|33|0.5|2.1|1 clove:3;100 g:100
Bell Pepper, raw|Vegetables|31|1|6|0.3|2.1|1 medium:119;100 g:100
Zucchini / Courgette|Vegetables|17|1.2|3.1|0.3|1|1 medium:196;100 g:100
Aubergine / Eggplant|Vegetables|25|1|5.9|0.2|3|1 medium:458;100 g:100
Mushroom, white raw|Vegetables|22|3.1|3.3|0.3|1|1 cup:70;100 g:100
Okra / Bhindi|Vegetables|33|1.9|7.5|0.2|3.2|1 cup:100;100 g:100
Green Beans|Vegetables|31|1.8|7|0.1|2.7|1 cup:125;100 g:100
Asparagus|Vegetables|20|2.2|3.9|0.1|2.1|1 cup:134;100 g:100
Beetroot, raw|Vegetables|43|1.6|9.6|0.2|2.8|1 medium:82;100 g:100
Pumpkin, raw|Vegetables|26|1|6.5|0.1|0.5|1 cup:116;100 g:100
Corn, sweet kernels|Vegetables|86|3.3|19|1.4|2|1 cup:154;100 g:100
Avocado|Fruits|160|2|8.5|14.7|6.7|1 medium:150;1/2 medium:75;100 g:100
Banana|Fruits|89|1.1|22.8|0.3|2.6|1 medium:118;100 g:100
Apple|Fruits|52|0.3|13.8|0.2|2.4|1 medium:182;100 g:100
Orange|Fruits|47|0.9|11.8|0.1|2.4|1 medium:131;100 g:100
Mango|Fruits|60|0.8|15|0.4|1.6|1 medium:207;100 g:100
Grapes|Fruits|69|0.7|18.1|0.2|0.9|1 cup:151;100 g:100
Watermelon|Fruits|30|0.6|7.6|0.2|0.4|1 slice:286;100 g:100
Strawberries|Fruits|32|0.7|7.7|0.3|2|1 cup:152;100 g:100
Blueberries|Fruits|57|0.7|14.5|0.3|2.4|1 cup:148;100 g:100
Pineapple|Fruits|50|0.5|13.1|0.1|1.4|1 cup:165;100 g:100
Papaya|Fruits|43|0.5|10.8|0.3|1.7|1 cup:145;100 g:100
Kiwi|Fruits|61|1.1|14.7|0.5|3|1 medium:69;100 g:100
Pomegranate|Fruits|83|1.7|18.7|1.2|4|1 cup arils:174;100 g:100
Dates, Medjool|Middle Eastern|277|1.8|75|0.2|6.7|1 date:24;3 dates:72;100 g:100
Dates, Khalas / dry|Middle Eastern|282|2.5|75|0.4|8|1 date:8;100 g:100
Figs, dried|Fruits|249|3.3|63.9|0.9|9.8|1 fig:8;100 g:100
Raisins|Fruits|299|3.1|79.2|0.5|3.7|1/4 cup:41;100 g:100
Almonds|Nuts & Seeds|579|21.2|21.6|49.9|12.5|1 oz / 23 nuts:28;100 g:100
Walnuts|Nuts & Seeds|654|15.2|13.7|65.2|6.7|1 oz:28;100 g:100
Cashews|Nuts & Seeds|553|18.2|30.2|43.9|3.3|1 oz:28;100 g:100
Pistachios|Nuts & Seeds|560|20.2|27.2|45.3|10.6|1 oz:28;100 g:100
Peanuts|Nuts & Seeds|567|25.8|16.1|49.2|8.5|1 oz:28;100 g:100
Peanut Butter|Nuts & Seeds|588|25.1|20|50.4|6|1 tbsp:16;2 tbsp:32;100 g:100
Almond Butter|Nuts & Seeds|614|21|18.8|55.5|10.3|1 tbsp:16;100 g:100
Tahini|Middle Eastern|595|17|21.2|53.8|9.3|1 tbsp:15;100 g:100
Chia Seeds|Nuts & Seeds|486|16.5|42.1|30.7|34.4|1 tbsp:12;100 g:100
Flax Seeds|Nuts & Seeds|534|18.3|28.9|42.2|27.3|1 tbsp:10;100 g:100
Pumpkin Seeds|Nuts & Seeds|559|30.2|10.7|49|6|1 oz:28;100 g:100
Sunflower Seeds|Nuts & Seeds|584|20.8|20|51.5|8.6|1 oz:28;100 g:100
Coconut, desiccated|Nuts & Seeds|660|6.9|23.7|64.5|16.3|1/4 cup:20;100 g:100
Hummus|Middle Eastern|166|7.9|14.3|9.6|6|1 tbsp:15;1 cup:246;100 g:100
Moutabal / Baba Ganoush|Middle Eastern|145|3|10|11|4.5|1 tbsp:15;100 g:100
Falafel|Middle Eastern|333|13.3|31.8|17.8|4.9|1 piece:17;5 pieces:85;100 g:100
Shawarma, chicken|Middle Eastern|215|18|12|11|1.2|1 wrap:250;100 g:100
Shawarma, beef|Middle Eastern|260|17|12|16|1.2|1 wrap:250;100 g:100
Kebab, chicken shish|Middle Eastern|175|24|1|8|0|1 skewer:120;100 g:100
Kebab, lamb kofta|Middle Eastern|248|17|4|18|0.5|1 skewer:100;100 g:100
Mandi / Kabsa Rice with chicken|Middle Eastern|195|11|24|6|1|1 plate:400;100 g:100
Tabbouleh|Middle Eastern|120|2.5|12|7|3|1 cup:100;100 g:100
Fattoush|Middle Eastern|110|2|11|6.5|2.5|1 cup:120;100 g:100
Mujadara|Middle Eastern|160|5|25|5|4|1 cup:200;100 g:100
Manakish Zaatar|Middle Eastern|300|7|38|13|3|1 piece:120;100 g:100
Vine Leaves / Warak Enab|Middle Eastern|140|3|20|5.5|3|5 pieces:100;100 g:100
Dal Tadka|Indian|130|6|17|4|4|1 bowl:200;100 g:100
Rajma Curry|Indian|140|7|20|3.5|6|1 bowl:200;100 g:100
Chana Masala|Indian|160|7|22|5|6|1 bowl:200;100 g:100
Chicken Curry|Indian|175|16|6|10|1.2|1 bowl:200;100 g:100
Butter Chicken|Indian|230|15|7|16|1|1 bowl:200;100 g:100
Chicken Biryani|Indian|200|10|24|7.5|1.5|1 plate:350;100 g:100
Veg Biryani|Indian|175|4|27|6|2.5|1 plate:350;100 g:100
Palak Paneer|Indian|180|9|8|13|2.5|1 bowl:200;100 g:100
Sambar|Indian|85|4|11|3|3|1 bowl:200;100 g:100
Rasam|Indian|45|2|6|1.5|1|1 bowl:200;100 g:100
Curd Rice|Indian|120|3.5|18|3.5|0.6|1 bowl:200;100 g:100
Aloo Gobi|Indian|105|3|13|5|3|1 bowl:180;100 g:100
Tandoori Chicken|Indian|165|25|3|6|0.4|1 piece:150;100 g:100
Samosa|Indian|308|5|32|18|2.5|1 samosa:60;100 g:100
Pakora|Indian|315|7|30|19|3|100 g:100
Whey Protein Isolate, powder|Supplements|373|86|4|1.5|0|1 scoop:30;100 g:100
Whey Protein Concentrate, powder|Supplements|400|76|10|6|0|1 scoop:32;100 g:100
Casein Protein, powder|Supplements|365|80|6|2|1|1 scoop:33;100 g:100
Plant Protein Blend, powder|Supplements|380|72|10|5|5|1 scoop:33;100 g:100
Mass Gainer, powder|Supplements|380|17|68|4|2|1 scoop:100;100 g:100
Creatine Monohydrate|Supplements|0|0|0|0|0|1 scoop:5;100 g:100
Protein Bar, typical|Supplements|350|30|35|10|8|1 bar:60;100 g:100
BCAA / EAA, powder|Supplements|0|0|0|0|0|1 scoop:10;100 g:100
Water|Beverages|0|0|0|0|0|1 glass (250 ml):250;1 bottle (500 ml):500;1 litre:1000
Black Coffee|Beverages|2|0.3|0|0|0|1 cup:240;100 ml:100
Latte, whole milk|Beverages|55|3|5|2.5|0|1 medium:350;100 ml:100
Cappuccino|Beverages|45|2.5|4|2|0|1 medium:240;100 ml:100
Karak Chai|Beverages|85|2.5|12|3|0|1 cup:150;100 ml:100
Tea, plain|Beverages|1|0|0.2|0|0|1 cup:240;100 ml:100
Green Tea|Beverages|1|0|0.2|0|0|1 cup:240;100 ml:100
Orange Juice|Beverages|45|0.7|10.4|0.2|0.2|1 glass:250;100 ml:100
Cola, regular|Beverages|42|0|10.6|0|0|1 can:330;100 ml:100
Cola, diet / zero|Beverages|0|0|0|0|0|1 can:330;100 ml:100
Energy Drink|Beverages|45|0|11|0|0|1 can:250;100 ml:100
Sports Drink / Isotonic|Beverages|25|0|6.2|0|0|1 bottle:500;100 ml:100
Coconut Water|Beverages|19|0.7|3.7|0.2|1.1|1 cup:240;100 ml:100
Beer, regular|Beverages|43|0.5|3.6|0|0|1 bottle:330;100 ml:100
Almond Milk, unsweetened|Beverages|15|0.6|0.6|1.1|0.3|1 cup:240;100 ml:100
Oat Milk|Beverages|47|1|7.5|1.5|0.8|1 cup:240;100 ml:100
Chocolate, dark 70%|Snacks & Sweets|598|7.8|45.9|42.6|10.9|1 square:10;1 bar:100;100 g:100
Chocolate, milk|Snacks & Sweets|535|7.6|59.4|29.7|3.4|1 bar:45;100 g:100
Ice Cream, vanilla|Snacks & Sweets|207|3.5|23.6|11|0.7|1 scoop:66;100 g:100
Potato Chips / Crisps|Snacks & Sweets|536|7|53|35|4.8|1 small bag:28;100 g:100
Popcorn, air popped|Snacks & Sweets|387|12.9|77.9|4.5|14.5|1 cup:8;100 g:100
Biscuit, digestive|Snacks & Sweets|480|6.8|62|22|3.5|1 biscuit:15;100 g:100
Croissant|Snacks & Sweets|406|8.2|45.8|21|2.6|1 croissant:57;100 g:100
Doughnut, glazed|Snacks & Sweets|452|4.9|51|25|1.5|1 doughnut:60;100 g:100
Kunafa|Middle Eastern|380|6|45|19|1.5|1 piece:100;100 g:100
Baklava|Middle Eastern|428|6.5|48|24|2.5|1 piece:40;100 g:100
Gulab Jamun|Indian|340|4|50|14|0.5|1 piece:40;100 g:100
Honey|Snacks & Sweets|304|0.3|82.4|0|0.2|1 tbsp:21;1 tsp:7;100 g:100
Sugar, white|Snacks & Sweets|387|0|100|0|0|1 tsp:4;1 tbsp:12;100 g:100
Maple Syrup|Snacks & Sweets|260|0|67|0.1|0|1 tbsp:20;100 g:100
Jam / Preserve|Snacks & Sweets|278|0.4|69|0.1|1.1|1 tbsp:20;100 g:100
Burger, beef fast food|Fast Food|295|17|24|14|1.5|1 burger:150;100 g:100
Cheeseburger, double|Fast Food|310|18|22|16|1.4|1 burger:250;100 g:100
Chicken Nuggets|Fast Food|296|15.5|18|18|1|6 pieces:96;100 g:100
Pizza, cheese|Fast Food|266|11|33|10|2.3|1 slice:107;100 g:100
Pizza, pepperoni|Fast Food|298|13|34|12|2.3|1 slice:111;100 g:100
Shawarma Sandwich (Arabic)|Fast Food|230|13|22|10|1.5|1 sandwich:200;100 g:100
Sushi, salmon roll|Fast Food|145|6|26|2|1|6 pieces:170;100 g:100
Pad Thai|Fast Food|180|8|24|6|1.8|1 plate:350;100 g:100
Fried Rice, chicken|Fast Food|165|7|22|5.5|1|1 plate:300;100 g:100
Caesar Salad with chicken|Fast Food|150|11|5|9.5|1.5|1 bowl:300;100 g:100
Ketchup|Condiments|101|1.7|25.8|0.1|0.3|1 tbsp:17;100 g:100
Mustard|Condiments|66|4|5|3.3|3.3|1 tsp:5;100 g:100
Soy Sauce|Condiments|53|8.1|4.9|0.6|0.8|1 tbsp:16;100 ml:100
Hot Sauce|Condiments|21|0.9|4.2|0.4|1.4|1 tsp:5;100 g:100
Vinegar, balsamic|Condiments|88|0.5|17|0|0|1 tbsp:16;100 ml:100
Garlic Sauce / Toum|Middle Eastern|600|1|5|65|0.5|1 tbsp:15;100 g:100
Salt|Condiments|0|0|0|0|0|1 tsp:6;100 g:100
Black Pepper|Condiments|251|10.4|64|3.3|25.3|1 tsp:2;100 g:100
Zaatar Mix|Middle Eastern|340|10|40|15|20|1 tbsp:8;100 g:100
Curry Powder|Indian|325|14|56|14|33|1 tsp:2;100 g:100
Cinnamon|Condiments|247|4|81|1.2|53|1 tsp:2.6;100 g:100
Turmeric|Indian|312|9.7|67|3.3|22.7|1 tsp:3;100 g:100
Ginger, fresh|Vegetables|80|1.8|17.8|0.8|2|1 tbsp:6;100 g:100
Chilli, green fresh|Vegetables|40|1.9|9|0.4|1.5|1 chilli:15;100 g:100
Coriander, fresh|Vegetables|23|2.1|3.7|0.5|2.8|1 handful:20;100 g:100
Mint, fresh|Vegetables|70|3.8|14.9|0.9|8|1 handful:15;100 g:100
Parsley, fresh|Vegetables|36|3|6.3|0.8|3.3|1 handful:20;100 g:100
Lemon Juice|Condiments|22|0.4|6.9|0.2|0.3|1 tbsp:15;100 ml:100
Olives, green|Middle Eastern|145|1|3.8|15.3|3.3|5 olives:20;100 g:100
Pickles / Mixed Torshi|Middle Eastern|20|0.6|4.2|0.2|1.5|100 g:100
Corn Flakes|Grains & Starches|357|7.5|84|0.4|3.3|1 bowl:30;100 g:100
Granola|Grains & Starches|471|10|64|20|7|1/2 cup:55;100 g:100
Muesli|Grains & Starches|362|9.7|66|5.9|7.7|1/2 cup:43;100 g:100
Weetabix / Wheat Biscuits|Grains & Starches|362|11.5|69|2|10|2 biscuits:38;100 g:100
Rice Cakes|Grains & Starches|387|8.2|81.5|2.8|4.2|1 cake:9;100 g:100
Protein Shake with milk, homemade|Supplements|75|9|5|2|0|1 shake (400 ml):400;100 ml:100
Bagel, plain|Grains & Starches|257|10|50.5|1.7|2.2|1 bagel:98;100 g:100
Pancake, plain|Snacks & Sweets|227|6.4|28|9.7|0.9|1 pancake:38;100 g:100
Waffle|Snacks & Sweets|291|7.9|32.9|14.1|2.1|1 waffle:75;100 g:100
Cheese Pizza Dough, raw|Grains & Starches|275|9|53|3.5|2|100 g:100
Flour, all purpose|Grains & Starches|364|10.3|76.3|1|2.7|1 cup:125;100 g:100
Flour, whole wheat / Atta|Indian|340|13.2|72|2.5|10.7|1 cup:120;100 g:100
Cornflour / Starch|Grains & Starches|381|0.3|91|0.1|0.9|1 tbsp:8;100 g:100
Baking Powder|Condiments|53|0|27.7|0|0.2|1 tsp:4;100 g:100
Coconut Milk, canned|Fats & Oils|230|2.3|5.5|24|2.2|1 cup:240;100 ml:100
Cream, heavy|Dairy & Eggs|340|2.1|2.8|36|0|1 tbsp:15;100 ml:100
Condensed Milk, sweetened|Dairy & Eggs|321|7.9|54.4|8.7|0|1 tbsp:19;100 g:100
Chicken Stock / Broth|Condiments|12|1.7|0.9|0.4|0|1 cup:240;100 ml:100
`.trim();

const FOOD_DB = FOOD_RAW.split('\n').map((line, i) => {
  const p = line.split('|');
  const servings = (p[7] || '100 g:100').split(';').map(s => {
    const [label, g] = s.split(':');
    return { label, g: parseFloat(g) };
  });
  return {
    id: 'f' + i,
    name: p[0],
    cat: p[1],
    kcal: +p[2], p: +p[3], c: +p[4], f: +p[5], fib: +p[6],
    servings,
    custom: false
  };
});

const FOOD_CATS = [...new Set(FOOD_DB.map(f => f.cat))].sort();

/* Quick-add water volumes (ml) */
const WATER_PRESETS = [200, 250, 330, 500, 750, 1000];

/* Meal slots used in the diet log */
const MEAL_SLOTS = [
  { id: 'breakfast', name: 'Breakfast', icon: 'sunrise' },
  { id: 'lunch', name: 'Lunch', icon: 'sun' },
  { id: 'dinner', name: 'Dinner', icon: 'moon' },
  { id: 'snacks', name: 'Snacks', icon: 'cookie' },
  { id: 'preworkout', name: 'Pre / Post Workout', icon: 'bolt' }
];
