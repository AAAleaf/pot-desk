import { addVocabWord, targetToText } from '../../../utils/vocab';

// 内置本地生词本：把当前翻译结果写入本地 sqlite (vocab.db)
export async function collection(source, target) {
    return await addVocabWord(source, targetToText(target));
}

export * from './Config';
export * from './info';
