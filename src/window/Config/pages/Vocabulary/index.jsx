import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@nextui-org/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react';
import { Input, Textarea, Button, Pagination, Tooltip } from '@nextui-org/react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { createDir, exists, writeTextFile } from '@tauri-apps/api/fs';
import { FaTrashAlt, FaEdit, FaFileCsv } from 'react-icons/fa';
import { open } from '@tauri-apps/api/shell';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
    clearVocabWords,
    countVocabWords,
    listVocabWords,
    removeVocabWord,
    updateVocabWord,
} from '../../../../utils/vocab';
import { useToastStyle } from '../../../../hooks';

const PAGE_SIZE = 20;

function pad(value) {
    return value.toString().padStart(2, '0');
}

function formatDate(timestamp) {
    if (!timestamp) {
        return '';
    }
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
        date.getMinutes()
    )}:${pad(date.getSeconds())}`;
}

function formatStamp() {
    const date = new Date();
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
        date.getMinutes()
    )}${pad(date.getSeconds())}`;
}

export default function Vocabulary() {
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [keyword, setKeyword] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectItem] = useState(null);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();
    const { isOpen: isClearOpen, onOpen: onClearOpen, onOpenChange: onClearOpenChange } = useDisclosure();

    const getData = async (targetPage = page, targetKeyword = keyword) => {
        try {
            const [count, rows] = await Promise.all([
                countVocabWords(targetKeyword),
                listVocabWords({
                    keyword: targetKeyword,
                    limit: PAGE_SIZE,
                    offset: PAGE_SIZE * (targetPage - 1),
                }),
            ]);
            setTotal(count);
            setItems(rows);
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    useEffect(() => {
        getData(page, keyword);
    }, [page, keyword]);

    const removeItem = async (id) => {
        try {
            await removeVocabWord(id);
            toast.success(t('config.vocabulary.delete_success'), { style: toastStyle });
            if (items.length === 1 && page > 1) {
                setPage(page - 1);
            } else {
                await getData();
            }
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    const clearAll = async () => {
        try {
            await clearVocabWords();
            setPage(1);
            await getData(1, keyword);
            toast.success(t('config.vocabulary.delete_success'), { style: toastStyle });
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    const saveItem = async () => {
        try {
            await updateVocabWord(selectedItem.id, {
                word: selectedItem.word,
                translation: selectedItem.translation,
                note: selectedItem.note,
            });
            toast.success(t('config.vocabulary.save_success'), { style: toastStyle });
            await getData();
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    const exportCsv = async () => {
        try {
            const rows = await listVocabWords({ keyword, limit: 100000, offset: 0 });
            if (rows.length === 0) {
                toast.error(t('config.vocabulary.nothing_to_export'), { style: toastStyle });
                return;
            }
            const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
            const header = ['word', 'translation', 'note', 'repeat_count', 'created_at', 'updated_at'];
            const lines = [header.join(',')];
            for (const row of rows) {
                lines.push(
                    [
                        row.word,
                        row.translation,
                        row.note,
                        row.repeat_count,
                        formatDate(row.created_at),
                        formatDate(row.updated_at),
                    ]
                        .map(escape)
                        .join(',')
                );
            }
            const csv = `\uFEFF${lines.join('\r\n')}`;
            const dir = await join(await appConfigDir(), 'export');
            if (!(await exists(dir))) {
                await createDir(dir, { recursive: true });
            }
            const filePath = await join(dir, `vocab-${formatStamp()}.csv`);
            await writeTextFile(filePath, csv);
            await open(dir);
            toast.success(t('config.vocabulary.export_success', { path: dir }), { style: toastStyle });
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        }
    };

    return (
        <>
            <Toaster />
            <div className='flex justify-between items-center mb-[10px]'>
                <div className='flex items-center gap-[10px]'>
                    <Input
                        size='sm'
                        isClearable
                        className='w-[280px]'
                        placeholder={t('config.vocabulary.search_placeholder')}
                        value={keyword}
                        onValueChange={(value) => {
                            setKeyword(value);
                            setPage(1);
                        }}
                        onClear={() => {
                            setKeyword('');
                            setPage(1);
                        }}
                    />
                    <div className='my-auto text-[13px] text-default-500'>
                        {t('config.vocabulary.total_count', { num: total })}
                    </div>
                </div>
                <div className='flex items-center gap-[10px]'>
                    <Button
                        size='sm'
                        variant='flat'
                        startContent={<FaFileCsv className='text-[16px]' />}
                        onPress={exportCsv}
                    >
                        {t('config.vocabulary.export_csv')}
                    </Button>
                    <Button
                        size='sm'
                        variant='light'
                        color='danger'
                        startContent={<FaTrashAlt className='text-[16px]' />}
                        onPress={onClearOpen}
                    >
                        {t('common.clear')}
                    </Button>
                </div>
            </div>

            <Table
                fullWidth
                aria-label='Vocabulary Table'
                classNames={{
                    base: 'h-[calc(100vh-150px)] overflow-y-auto',
                    td: 'px-0',
                }}
            >
                <TableHeader>
                    <TableColumn key='word'>{t('config.vocabulary.word')}</TableColumn>
                    <TableColumn key='translation'>{t('config.vocabulary.translation')}</TableColumn>
                    <TableColumn key='repeat_count'>{t('config.vocabulary.repeat_count')}</TableColumn>
                    <TableColumn key='updated_at'>{t('config.vocabulary.updated_at')}</TableColumn>
                    <TableColumn key='actions'>{t('config.vocabulary.actions')}</TableColumn>
                </TableHeader>
                <TableBody
                    emptyContent={t('config.vocabulary.empty')}
                    items={items}
                >
                    {(item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <p className='w-[180px] whitespace-nowrap text-ellipsis overflow-hidden'>
                                    {item.word}
                                </p>
                            </TableCell>
                            <TableCell>
                                <p className='w-[380px] whitespace-nowrap text-ellipsis overflow-hidden'>
                                    {item.translation}
                                </p>
                            </TableCell>
                            <TableCell>
                                <p className='w-[60px] text-center'>{item.repeat_count}</p>
                            </TableCell>
                            <TableCell>
                                <p className='w-[150px] text-center whitespace-nowrap'>
                                    {formatDate(item.updated_at)}
                                </p>
                            </TableCell>
                            <TableCell>
                                <div className='flex'>
                                    <Tooltip content={t('config.vocabulary.detail')}>
                                        <Button
                                            isIconOnly
                                            size='sm'
                                            variant='light'
                                            onPress={() => {
                                                setSelectItem({ ...item });
                                                onOpen();
                                            }}
                                        >
                                            <FaEdit className='text-[16px]' />
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content={t('common.delete')}>
                                        <Button
                                            isIconOnly
                                            size='sm'
                                            variant='light'
                                            color='danger'
                                            onPress={() => {
                                                removeItem(item.id);
                                            }}
                                        >
                                            <FaTrashAlt className='text-[16px]' />
                                        </Button>
                                    </Tooltip>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            <div className='mt-[8px] flex justify-center'>
                <Pagination
                    showControls
                    isCompact
                    total={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                    page={page}
                    onChange={setPage}
                />
            </div>

            <Modal
                isOpen={isOpen}
                onOpenChange={onOpenChange}
                scrollBehavior='inside'
            >
                <ModalContent className='max-h-[80vh]'>
                    {(onClose) =>
                        selectedItem && (
                            <>
                                <ModalHeader>{t('config.vocabulary.detail')}</ModalHeader>
                                <ModalBody>
                                    <Input
                                        label={t('config.vocabulary.word')}
                                        labelPlacement='outside'
                                        value={selectedItem.word}
                                        variant='bordered'
                                        onValueChange={(value) => {
                                            setSelectItem({ ...selectedItem, word: value });
                                        }}
                                    />
                                    <Textarea
                                        label={t('config.vocabulary.translation')}
                                        labelPlacement='outside'
                                        minRows={4}
                                        value={selectedItem.translation ?? ''}
                                        variant='bordered'
                                        onChange={(e) => {
                                            setSelectItem({ ...selectedItem, translation: e.target.value });
                                        }}
                                    />
                                    <Textarea
                                        label={t('config.vocabulary.note')}
                                        labelPlacement='outside'
                                        minRows={2}
                                        value={selectedItem.note ?? ''}
                                        variant='bordered'
                                        onChange={(e) => {
                                            setSelectItem({ ...selectedItem, note: e.target.value });
                                        }}
                                    />
                                </ModalBody>
                                <ModalFooter className='flex justify-between'>
                                    <Button
                                        color='primary'
                                        onPress={async () => {
                                            await saveItem();
                                            onClose();
                                        }}
                                    >
                                        {t('common.save')}
                                    </Button>
                                    <Button
                                        color='danger'
                                        variant='light'
                                        onPress={async () => {
                                            await removeItem(selectedItem.id);
                                            onClose();
                                        }}
                                    >
                                        {t('common.delete')}
                                    </Button>
                                </ModalFooter>
                            </>
                        )
                    }
                </ModalContent>
            </Modal>

            <Modal
                isOpen={isClearOpen}
                onOpenChange={onClearOpenChange}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t('config.vocabulary.clear_confirm_title')}</ModalHeader>
                            <ModalBody>
                                <p>{t('config.vocabulary.clear_confirm')}</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button
                                    color='danger'
                                    onPress={async () => {
                                        onClose();
                                        await clearAll();
                                    }}
                                >
                                    {t('common.ok')}
                                </Button>
                                <Button
                                    variant='light'
                                    onPress={onClose}
                                >
                                    {t('common.cancel')}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </>
    );
}
