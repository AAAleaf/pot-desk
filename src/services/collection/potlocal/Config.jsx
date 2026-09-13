import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Button, Input } from '@nextui-org/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';

import { useConfig } from '../../../hooks';
import { countVocabWords } from '../../../utils/vocab';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [total, setTotal] = useState(null);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.potlocal.title'),
        },
        { sync: false }
    );

    useEffect(() => {
        countVocabWords()
            .then((value) => {
                setTotal(value);
            })
            .catch(() => {
                setTotal(null);
            });
    }, []);

    return (
        config !== null && (
            <>
                <div className='config-item'>
                    <Input
                        label={t('services.instance_name')}
                        labelPlacement='outside-left'
                        value={config[INSTANCE_NAME_CONFIG_KEY]}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--nextui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setConfig({
                                ...config,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <h3 className='my-auto select-none cursor-default'>
                        {t('services.collection.potlocal.total_words')}
                    </h3>
                    <div className='my-auto'>{total === null ? '-' : total}</div>
                </div>
                <div className='config-item'>
                    <h3 className='my-auto select-none cursor-default'>
                        {t('services.collection.potlocal.words_list')}
                    </h3>
                    <Button
                        onPress={() => {
                            onClose();
                            navigate('/vocabulary');
                        }}
                    >
                        {t('services.collection.potlocal.open')}
                    </Button>
                </div>
                <div>
                    <Button
                        fullWidth
                        color='primary'
                        onPress={() => {
                            setConfig(config, true);
                            updateServiceList(instanceKey);
                            onClose();
                        }}
                    >
                        {t('common.save')}
                    </Button>
                </div>
            </>
        )
    );
}
