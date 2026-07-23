# 99 跨 GDD 一致性评审 Consistency Review

> 阶段：Phase 2 收尾｜评审对象：01~11 共 11 个 GDD + 00-index

## 1. 评审范围
跨文档一致性核查 + IP 合规：统一输入命名、统一实体 schema、关卡 beat 字段、受伤/形态状态机正交、IP 红线。

## 2. 统一输入事件命名 ✅
- 全局常量 `INPUT_LEFT / INPUT_RIGHT / INPUT_JUMP / INPUT_ACTION`（00 §1.2）。
- 引用一致：01 定义；03 消费 LEFT/RIGHT/JUMP；08 消费 ACTION（暂停）；04 不直接消费输入（由 03/伤害事件驱动）。
- 结论：命名统一，无平台分支泄漏。

## 3. 统一实体配置 Schema ✅
- 基字段 `id/type/x/y/width/height/variant/params/tags`（00 §1.3）。
- 敌人 04 用 `EntityDef`（`type∈ci_li/chong_feng/du_fu/shi_pao`）+ params；props 05 用 `PropDef`（`type=interactive_block` + content）。
- 共用 x/y/params，无重复定义、无冲突字段。
- 结论：schema 统一，敌人/道具可共用加载管线。

## 4. 关卡数据格式承载 beat 字段 ✅
- 05 `LevelData.beat{enabled,bpm,grid,tracks}`，10 解析，MVP `enabled:false`。
- `tracks` 预留为 Could 机制扩展，不破 05 schema（向后兼容）。
- 结论：格式可承载节拍预留，任务三核查通过。

## 5. 受伤状态机 vs 形态状态机不冲突 ✅
- 受伤 `DamageState{FULL/SMALL/DEAD}` 控制尺寸/无敌/重生（07）。
- 形态 `FormState{BASE/TRANSFORMED}` 控制能力（MVP 仅 BASE，树→Could）。
- **正交规则（07 §3）**：受伤转换不改 `form`；仅 `DEAD→重生` 复位 `form=BASE`。尺寸由 07 单点输出 `sizeScale` 给 03/08，禁止他系统直接改尺寸。
- 状态×事件矩阵明确，无交叉写入。
- 结论：两状态机正交，无冲突。

## 6. IP 合规核查 ✅
逐项核对任天堂符号/命名红线（美术圣经 v1.1 + 概念文档）：
- 角色：**栗宝**（原创种子精灵，头顶嫩芽；无帽檐/背带裤/胡子/水管工轮廓）。
- 敌人：**刺栗 / 冲锋怪 / 嘟浮 / 石炮**（原创；无蘑菇/乌龟/星星/龟壳）。
- 终点：**凯旋之门**（原创；无旗杆）。
- 道具：**元气果**（果实+嫩芽，无蘑菇/星星/火焰花）、爱心/金币/壳珠（原创造型）。
- 命名：`super-mali` 为项目代号非马里奥；"栗宝 Mali"呼应项目名无混淆。
- 音乐/机制：仅借鉴横版跳跃结构，全原创。
- 结论：无任天堂符号/命名，IP 红线通过。

## 7. 其余一致性观察
- 单位统一：速度 px/s、加速度 px/s²、时长 ms（00 §1.1），各 GDD 一致。
- 事件命名：`ON_XXX` 常量风格，跨系统一致。
- 参数集中 config（character/enemy/economy/damage-config），易调易评审。
- 依赖图（00 §2.2）无环，构建顺序可行。

## 8. 残留开放问题（供主理人拍板）
1. 触屏输入布局（01）：左右双按钮 vs 左摇杆。
2. 二段跳 MVP 必做？（03）
3. 下穿单向平台（02）。
4. MVP 关卡长度 / parTime（05）。
5. 结算星级权重（08）。
6. 节拍时钟：纯逻辑 vs AudioContext（10）。
7. 音频 MVP 占位 vs 静音（09）。
8. 元循环：关卡地图 vs 直进下一关（11）。

## 9. 评审结论
11 个系统 GDD 在**命名 / 数据格式 / 状态机 / IP** 四个维度一致、无冲突、可落地。MVP 边界清晰（4 敌、单关、节拍仅接口、混合 UI）。建议主理人就 §8 八项开放问题拍板后进入工程实现（Phase 3）。
