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

## 10. 配色变更登记（supersede 记录）

### 10.1 chong_feng 钢蓝 → 警示红 #E8483B（主理人拍板，S04-2 落地）
- **决策**：冲锋怪 `chong_feng` 权威配色由"钢蓝 `#3D6FB4`"改为**警示红 `#E8483B`**（强化不可踩危险感，与可踩敌 soft 圆顶对比）。渲染（S04-2 `enemy-view.ts`）已落地验证。
- **撤销范围（本次修订）**：
  - `design/gdd/04-enemy-ai.md` §3：原"钢蓝"→ 警示红 #E8483B，附 supersede 说明（形状双编码 + 色盲安全）。
  - `art/asset-spec.md` §2.2 / §2.5：chong_feng 主体 钢蓝→警示红 #E8483B，原钢蓝规格标记 superseded。
- **已知权衡（非阻断）**：`ci_li` 与 `chong_feng` 同为警示红 #E8483B，辨识靠**形状双编码**（刺栗=圆球带刺 soft 顶 / 冲锋怪=长条楔形 hard 顶）；剪影即可辨能否踩，色盲安全。不引入新主导策略/认知过载。
- **待清理（超出本次范围，建议后续统一）**：其余仍写"钢蓝"的文档——`art/art-bible.md` §4.3 / §3.2、`art/asset-manifest.md` §2.3 / §3 / §6.5、`art/accessibility.md` GAP-1、`art/placeholder-spec.md` 敌表 / 色板清单、`docs/architecture/control-list.md` §敌人造型、`docs/phase-gates/phase2-quality-gate.md` §2。其中 `art-bible.md` 的"锥冲用钢蓝=冷蓝危险语义"论述已失效，建议同步改写（涉及上游视觉身份文档，需主理人确认）。
- **四敌配色自洽核对**：ci_li=警示红 #E8483B / du_fu=蓝紫 #6E7BF2 / chong_feng=警示红 #E8483B / shi_pao=灰。两红靠形状区分；du_fu 蓝紫避开增益紫 #9B6CF2；无新增冲突。✅
