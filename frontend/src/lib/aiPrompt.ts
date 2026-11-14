/**
 * 「AI に相談」で外部の AI チャットへ渡すプロンプトと、その開き方。
 *
 * いま画面に出ている内容（検索条件・カフェの一覧・開いている店）を文章にまとめ、
 * Durian Map の URL と一緒に渡す。AI 側は URL の先を読めないことがあるので、
 * 判断に要る情報はプロンプトの本文に書いておく。
 */

import type { Cafe } from './api';
import { formatAddress, getOpenStatusLabel, getPriceLabel } from './cafe';

/** プロンプトに載せるカフェの上限。URL に載せて渡すので、長すぎると開けない。 */
const MAX_CAFES = 8;

export type AiPromptContext = {
    /** いまの画面に戻れる Durian Map の URL。 */
    url: string;
    /** 一覧の見出し（「谷中のカフェ」など）。未検索なら null。 */
    title: string | null;
    cafes: readonly Cafe[];
    /** 詳細を開いている店。開いていなければ null。 */
    selected: Cafe | null;
};

function describeCafe(cafe: Cafe): string {
    const openStatus = getOpenStatusLabel(cafe);
    const facts = [
        cafe.rating != null ? `評価 ${cafe.rating.toFixed(1)}${cafe.userRatingCount != null ? `（${cafe.userRatingCount}件）` : ''}` : null,
        cafe.openNow === undefined ? null : `${cafe.openNow ? '営業中' : '営業時間外'}${openStatus ? ` ${openStatus.value}${openStatus.suffix}` : ''}`,
        getPriceLabel(cafe),
        formatAddress(cafe.address),
    ].filter(Boolean);

    return `- ${cafe.name}: ${facts.join(' / ')}`;
}

/** AI に渡すプロンプト。画面の状況で 3 通りに分かれる。 */
export function buildAiPrompt({ url, title, cafes, selected }: AiPromptContext): string {
    const intro = 'Durian Map は、大手チェーンを除いて個人経営のカフェだけを地図で探せるアプリです。';

    if (selected) {
        return [
            intro,
            `いま「${selected.name}」を見ています。`,
            describeCafe(selected),
            selected.weekdayDescriptions?.length ? `営業時間: ${selected.weekdayDescriptions.join(' / ')}` : null,
            selected.websiteUri ? `ウェブサイト: ${selected.websiteUri}` : null,
            `Durian Map で開く: ${url}`,
            '',
            'この店について、どんな雰囲気か、どんな使い方（作業・読書・友人と・ひとりで）に向いていそうか、行く前に知っておくとよいことを教えてください。分からないことは推測せず、分からないと言ってください。',
        ]
            .filter((line) => line !== null)
            .join('\n');
    }

    if (cafes.length > 0) {
        return [
            intro,
            `${title ?? 'カフェ'}を探していて、次の ${Math.min(cafes.length, MAX_CAFES)} 軒が候補です。`,
            ...cafes.slice(0, MAX_CAFES).map(describeCafe),
            `Durian Map で開く: ${url}`,
            '',
            'この中から行き先を決めたいです。まず、いまの気分や用途（作業したい、ゆっくり話したい、甘いものが食べたい など）を 1 つだけ質問してください。その答えに合わせて、上の候補から 2〜3 軒を理由つきですすめてください。候補に無い店は挙げないでください。',
        ].join('\n');
    }

    return [
        intro,
        `Durian Map: ${url}`,
        '',
        'カフェ探しを手伝ってください。まず、どのあたりで探したいか（駅名や町名）と、どんな過ごし方をしたいかを質問してください。そのうえで、Durian Map でどのエリア名を検索するとよいかを提案してください。',
    ].join('\n');
}

export type AiTarget = { id: 'chatgpt' | 'claude'; label: string; href: (prompt: string) => string };

/** プロンプトを入れた状態で開ける AI チャット。どちらも `q` に入れた文章が入力欄に入る。 */
export const AI_TARGETS: readonly AiTarget[] = [
    { id: 'chatgpt', label: 'ChatGPT で開く', href: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}` },
    { id: 'claude', label: 'Claude で開く', href: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}` },
];
