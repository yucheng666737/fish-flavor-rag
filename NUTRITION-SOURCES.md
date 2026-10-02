# 營養與飲用資料來源

查核日期：2026-10-02。數值採公開資料，不由模型自行編造，也不轉換為這個設計配方每瓶的實際營養標示。

## 原料數值

直接下載 USDA FoodData Central 的 SR Legacy 2018 官方 JSON 壓縮檔，依 FDC ID 讀取營養數值與單位。每100克的資料定義見官方資料字典。此為有年份的原料參考資料，不代表最新個別商品檢測。

- [官方下載頁](https://fdc.nal.usda.gov/download-datasets/)
- [SR Legacy 官方 JSON](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip)
- [資料字典](https://fdc.nal.usda.gov/portal-data/external/dataDictionary)

| 介面食材 | 採用的原料形式 | FDC ID | 每100克的代表數值 |
| --- | --- | --- | --- |
| 檸檬 | 去皮生檸檬 | 167746 | 維生素 C 53 mg；膳食纖維 2.8 g |
| 柳橙 | 生柳橙可食部 | 169097 | 維生素 C 53.2 mg；膳食纖維 2.4 g |
| 蜂蜜 | 蜂蜜 | 169640 | 總糖 82.1 g；熱量 304 kcal |
| 薑汁 | 生薑根，僅作原料參考 | 169231 | 鉀 415 mg；膳食纖維 2 g |
| 薄荷 | 新鮮胡椒薄荷葉 | 173474 | 鈣 243 mg；鉀 569 mg |
| 香草 | 香草萃取液 | 173471 | 總糖 12.6 g；熱量 288 kcal |
| 肉桂 | 研磨肉桂粉 | 171320 | 膳食纖維 53.1 g；鈣 1000 mg |
| 蔓越莓 | 生蔓越莓 | 171722 | 維生素 C 14 mg；膳食纖維 3.6 g |
| 枸杞 | 乾燥枸杞 | 173032 | 膳食纖維 13 g；鐵 6.8 mg |
| 洋甘菊 | 沖泡茶、未加糖 | 174156 | 熱量 1 kcal；總糖 0 g |

100克是統一比較單位，尤其香料與萃取液不是建議一次攝取量。果肉、乾果或葉片的數字不能直接當成過濾飲品中的營養。

## 鱸魚精與食用花卉

- [MU10牧田露露魚淬](https://www.mu10.com.tw/products/fish_tw01)：製造商公開蛋白質11 g／100 mL、BCAA 900 mg／100 mL。必須保留品牌與商品參考性質，不能代表所有鱸魚精或本配方。
- [Colorado State University Extension：Edible Flowers](https://www.extension.colostate.edu/docs/pubs/garden/07237.pdf)：確認薰衣草與玫瑰的食用用途，這兩項呈現食用花草特色，不填入推測的營養含量。

## 飲用與保存

- [蘇蔡農場原味魚精](https://www.sutsaiorganicfarm.com.tw/products-112.html)：參考溫熱、拆封倒入容器、包裝不可直接微波及開封儘速飲用等說明，不套用品牌特定加熱秒數或每日份量。
- [FDA 食品保存](https://www.fda.gov/consumers/consumer-updates/are-you-storing-food-safely)
- [FDA 過敏原](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies)
- [FDA 添加糖](https://www.fda.gov/food/nutrition-facts-label/added-sugars-nutrition-facts-label)
- [CDC 嬰幼兒食品注意事項](https://www.cdc.gov/infant-toddler-nutrition/foods-and-drinks/foods-and-drinks-to-avoid-or-limit.html)

一般品飲情境與少量調味屬設計建議，文件已區分其性質；未引用品牌的治療或健康功效宣稱。
# 呈現更新（2026-10-03）

前端不顯示市售品牌。鱸魚精摘要已移除特定商品的蛋白質／BCAA 數值，改為營養標示閱讀提示；下面保留原始研究紀錄，不能將品牌數值當作本配方或所有同類飲品的數值。飲用建議以包裝與容器說明為準，研究來源仍保留於知識文件。
