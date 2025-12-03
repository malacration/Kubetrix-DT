// src/app/layout/Routes.tsx

import React, { lazy, Suspense } from 'react';
import { Route, Routes } from "react-router-dom";
import { Home } from '../pages/Home';
import { useParams } from 'react-router-dom';
import { exec } from 'child_process';

// 🔧 Mapeador de páginas dinâmicas:
const dynamicImport = (prefix: string, page: string) => {
  try {
    return lazy(() =>
      import(`./../pages/${prefix}/${page}.tsx`)
    );
  } catch (err) {
    console.error('Erro ao carregar o exemplo:', err);
    // eslint-disable-next-line react/display-name
    return () => <div>Exemplo não encontrado</div>;
  }
};

// 🧠 Utilitário para converter slug para nome de arquivo:
const toPascalCase = (slug: string) =>
  slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

// 🎯 Componente para rota dinâmica:
const DynamicExample = ({ example, prefix }: { example: string, prefix : string }) => {
  const Component = dynamicImport(prefix,toPascalCase(example));
  return (
    <Suspense fallback={<div>Carregando exemplo...</div>}>
      <Component />
    </Suspense>
  );
};


export const MyRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      
      <Route
        path="/exemplos/:example"
        element={
          <RouteWrapper prefix={"exemplos"} />
        }
      />
      <Route
        path="/dashboards/:example"
        element={
          <RouteWrapper prefix={"dashboards"} />
        }
      />
    </Routes>
  );
};

const RouteWrapper = (param : {prefix : string}) => {
  const { example } = useParams<{ example: string }>();
  if (!example) return <div>Exemplo não informado</div>;
  return <DynamicExample example={example} prefix={param.prefix} />;
};
