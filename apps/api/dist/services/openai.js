import { aiClassificationSchema, aiResponseSchema } from '../schemas/ai.js';
export const classifyTicket = async (apiKey, mensagem) => {
    const prompt = 'Classifique esta mensagem entre: saúde, educação, trânsito ou infraestrutura urbana.';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            temperature: 0.2,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: mensagem }
            ]
        })
    });
    if (!response.ok) {
        throw new Error('Falha ao classificar ticket');
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.toLowerCase().trim() ?? '';
    const normalized = content
        .replace('saúde', 'saude')
        .replace('educação', 'educacao')
        .replace('trânsito', 'transito');
    return aiClassificationSchema.parse(normalized);
};
export const generateResponse = async (apiKey, mensagem) => {
    const prompt = 'Gere uma resposta cordial e formal para esta demanda:';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4',
            temperature: 0.2,
            messages: [
                { role: 'system', content: prompt },
                { role: 'user', content: mensagem }
            ]
        })
    });
    if (!response.ok) {
        throw new Error('Falha ao gerar resposta');
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    return aiResponseSchema.parse(content);
};
