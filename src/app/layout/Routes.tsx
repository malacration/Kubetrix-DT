// src/app/layout/Routes.tsx

import React, { lazy, Suspense } from 'react';
import { Route, Routes as ReactRoutes } from 'react-router-dom';
import { Home } from '../pages/Home';

// 🔧 Mapeador de páginas dinâmicas:
const dynamicImport = (prefix: string, page: string) => {
  try {
    return lazy(() =>
      import(`./../pages/${prefix}/${page}.tsx`)
    );
  } catch (err) {
    console.error('Erro ao carregar o exemplo:', err);
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
  console.log(">>>>>>>>>>",toPascalCase(example))
  const Component = dynamicImport(prefix,toPascalCase(example));
  return (
    <Suspense fallback={<div>Carregando exemplo...</div>}>
      <Component />
    </Suspense>
  );
};

export const Routes = () => {
  return (
    <ReactRoutes>
      <Route path="/" element={<Home />} />
      
      {/* 💡 Rota dinâmica para exemplos */}
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
    </ReactRoutes>
  );
};

// wrapper que usa useParams para capturar o slug
import { useParams } from 'react-router-dom';
import { exec } from 'child_process';
const RouteWrapper = (param : {prefix : string}) => {
  const { example } = useParams<{ example: string }>();
  if (!example) return <div>Exemplo não informado</div>;
  return <DynamicExample example={example} prefix={param.prefix} />;
};
