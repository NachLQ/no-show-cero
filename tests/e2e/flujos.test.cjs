const {test}=require('node:test'),assert=require('node:assert/strict');const {fixture}=require('./fixture.cjs');
test('agenda: citas, depósito, reprogramación, asistencia y hueco recuperado',async()=>{
 const f=await fixture();try{
  await f.json('post','/api/config/restablecer',{confirmar:'BORRAR'});
  const types=await f.json('get','/api/tipos-cita'),type=types[0];await f.json('put',`/api/tipos-cita/${type.id}`,{nombre:'Servicio E2E',precio:80,politica_deposito:'siempre',importe_deposito:20});
  const client=await f.json('post','/api/clientes',{nombre:'Cliente E2E',telefono:'600000001'}),next=new Date(Date.now()+72*3600000).toISOString();
  const {cita,deposito_solicitado}=await f.json('post','/api/citas',{cliente_id:client.id,tipo_cita_id:type.id,fecha_hora:next});assert.equal(deposito_solicitado,true);assert.equal(cita.deposito.importe,20);
  const paid=await f.json('post',`/api/depositos/${cita.deposito.id}/registrar`,{});assert.equal(paid.estado,'confirmada');
  const moved=await f.json('post',`/api/citas/${cita.id}/reprogramar`,{fecha_hora:next});assert.equal(moved.estado,'pendiente');await f.json('post',`/api/citas/${cita.id}/confirmar`,{});
  const attended=await f.json('post',`/api/citas/${cita.id}/resultado`,{resultado:'asistida'});assert.equal(attended.estado,'asistida');assert.equal(attended.deposito.estado,'aplicado');
  const second=await f.json('post','/api/clientes',{nombre:'Espera E2E',telefono:'600000002'}),wait=await f.json('post','/api/lista-espera',{cliente_id:second.id,tipo_cita_id:type.id});
  const booking=await f.json('post','/api/citas',{cliente_id:client.id,tipo_cita_id:type.id,fecha_hora:next});const cancelled=await f.json('post',`/api/citas/${booking.cita.id}/cancelar`,{});assert.equal(cancelled.cita.estado,'cancelada');assert.equal(cancelled.tardia,false);
  const messages=await f.json('get','/api/mensajes'),offer=messages.find(m=>m.tipo==='oferta_hueco'&&m.cita_id===booking.cita.id);assert.ok(offer,'Se debe ofrecer el hueco a la lista de espera');
  const recovered=await f.json('post',`/api/mensajes/${offer.id}/aceptar-hueco`,{});assert.equal(recovered.importe_recuperado,80);assert.equal(recovered.cita.cliente_id,second.id);assert.equal(recovered.cita.estado,'confirmada');
  assert.ok(!(await f.json('get','/api/lista-espera')).some(x=>x.id===wait.id));
  const w=await f.json('post','/api/lista-espera',{cliente_id:second.id});await f.json('delete',`/api/lista-espera/${w.id}`);assert.ok(!(await f.json('get','/api/lista-espera')).some(x=>x.id===w.id));
  await f.json('post','/api/config/restablecer',{confirmar:'BORRAR'});assert.equal((await f.json('get','/api/clientes')).length,0);
 }finally{await f.close();}
});
