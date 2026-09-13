import Database from 'tauri-plugin-sql-api';

const DB_PATH = 'sqlite:vocab.db';

const CREATE_TABLE_SQL =
    "CREATE TABLE IF NOT EXISTS vocab(id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT NOT NULL, translation TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', repeat_count INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)";

const CREATE_INDEX_SQL = 'CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_word ON vocab(word)';

let databasePromise = null;

// 单例：避免每次 load 都新建一个 sqlite 连接池
export function getVocabDatabase() {
    if (databasePromise === null) {
        databasePromise = (async () => {
            const db = await Database.load(DB_PATH);
            await db.execute(CREATE_TABLE_SQL);
            try {
                await db.execute(CREATE_INDEX_SQL);
            } catch (e) {
                console.warn('Create unique index for vocab failed', e);
            }
            return db;
        })();
        databasePromise.catch(() => {
            databasePromise = null;
        });
    }
    return databasePromise;
}

// 词典类翻译服务返回的 target 是对象，这里统一压成可读文本
export function targetToText(target) {
    if (target === null || target === undefined || target === '') {
        return '';
    }
    if (typeof target !== 'object') {
        return String(target);
    }

    let result = '';
    if (Array.isArray(target.explanations)) {
        for (const explanation of target.explanations) {
            if (explanation.trait) {
                const trait = explanation.trait.endsWith('.') ? explanation.trait : `${explanation.trait}.`;
                result += `${trait} `;
            }
            if (Array.isArray(explanation.explains)) {
                result += explanation.explains.join('; ');
            }
            result += '\n';
        }
    }
    if (Array.isArray(target.pronunciations)) {
        const symbols = target.pronunciations
            .map((pronunciation) => {
                const region = pronunciation.region ? `[${pronunciation.region}] ` : '';
                let symbol = pronunciation.symbol ?? '';
                if (symbol !== '' && !symbol.startsWith('/')) {
                    symbol = `/${symbol}/`;
                }
                return `${region}${symbol}`.trim();
            })
            .filter((symbol) => symbol !== '');
        if (symbols.length > 0) {
            result = `${symbols.join(' ')}\n${result}`;
        }
    }

    const text = result.trim();
    return text !== '' ? text : JSON.stringify(target);
}

export async function addVocabWord(word, translation, options = {}) {
    const { note = '', deduplicate = true } = options;
    const text = String(word ?? '').trim();
    if (text === '') {
        throw new Error('Empty word');
    }

    const db = await getVocabDatabase();
    const now = Date.now();
    const found = await db.select('SELECT id, repeat_count FROM vocab WHERE word=$1', [text]);

    if (found.length > 0 && deduplicate) {
        const repeatCount = (found[0].repeat_count ?? 1) + 1;
        await db.execute('UPDATE vocab SET translation=$1, note=$2, repeat_count=$3, updated_at=$4 WHERE id=$5', [
            translation ?? '',
            note,
            repeatCount,
            now,
            found[0].id,
        ]);
        return { created: false, repeatCount };
    }

    await db.execute(
        'INSERT INTO vocab (word, translation, note, repeat_count, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [text, translation ?? '', note, 1, now, now]
    );
    return { created: true, repeatCount: 1 };
}

export async function listVocabWords(options = {}) {
    const { keyword = '', limit = 20, offset = 0 } = options;
    const db = await getVocabDatabase();
    const trimmed = keyword.trim();

    if (trimmed !== '') {
        const like = `%${trimmed}%`;
        return await db.select(
            'SELECT * FROM vocab WHERE word LIKE $1 OR translation LIKE $1 OR note LIKE $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3',
            [like, limit, offset]
        );
    }
    return await db.select('SELECT * FROM vocab ORDER BY updated_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
}

export async function countVocabWords(keyword = '') {
    const db = await getVocabDatabase();
    const trimmed = keyword.trim();

    if (trimmed !== '') {
        const like = `%${trimmed}%`;
        const result = await db.select(
            'SELECT COUNT(*) AS total FROM vocab WHERE word LIKE $1 OR translation LIKE $1 OR note LIKE $1',
            [like]
        );
        return result[0]?.total ?? 0;
    }
    const result = await db.select('SELECT COUNT(*) AS total FROM vocab');
    return result[0]?.total ?? 0;
}

export async function updateVocabWord(id, values = {}) {
    const { word = '', translation = '', note = '' } = values;
    const text = String(word).trim();
    if (text === '') {
        throw new Error('Empty word');
    }

    const db = await getVocabDatabase();
    await db.execute('UPDATE vocab SET word=$1, translation=$2, note=$3, updated_at=$4 WHERE id=$5', [
        text,
        translation ?? '',
        note ?? '',
        Date.now(),
        id,
    ]);
}

export async function removeVocabWord(id) {
    const db = await getVocabDatabase();
    await db.execute('DELETE FROM vocab WHERE id=$1', [id]);
}

export async function clearVocabWords() {
    const db = await getVocabDatabase();
    await db.execute('DELETE FROM vocab');
    try {
        await db.execute("DELETE FROM sqlite_sequence WHERE name='vocab'");
    } catch (e) {
        console.warn('Reset vocab autoincrement failed', e);
    }
}
