import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F172A', 
    padding: 24, 
    // Espaço extra em baixo para o conteúdo não ficar colado à barra flutuante
    paddingBottom: 120,
    justifyContent: 'center', 
  },
  // 1. Texto maior (fontSize 18) e mais espaçado
  infoText: {
    color: '#94A3B8', 
    textAlign: 'center',
    fontSize: 18, 
    marginBottom: 30,
    lineHeight: 28
  },
  highlight: {
    color: '#FFFFFF',
    fontWeight: 'bold'
  },
  
  buttonsContainer: {
    gap: 15,
  },
  mainButton: { 
    backgroundColor: '#1E293B', 
    paddingVertical: 18, 
    borderRadius: 12, 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  mainButtonHighlight: { 
    backgroundColor: '#FDE047', 
    borderColor: '#FDE047'
  },
  mainButtonText: { color: '#94A3B8', fontSize: 18, fontWeight: 'bold' },
  mainButtonTextHighlight: { color: '#0F172A', fontSize: 18, fontWeight: 'bold' },
  
  // Contentor para dar destaque ao slider no meio do ecrã
  pickerContainer: {
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 10,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#334155'
  },

  // 4. Estilos do Popup corrigidos para evitar o ecrã preto
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)', // Fundo escuro mais opaco para esconder bem o que está atrás
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155'
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FDE047',
    textAlign: 'center',
    marginBottom: 20
  },
  closeButton: {
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  closeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  
  card: { 
    backgroundColor: '#1E293B', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    borderLeftWidth: 4, 
    borderLeftColor: '#FDE047'
  },
  timeInfo: { flexDirection: 'column' },
  timeText: { fontSize: 28, fontWeight: 'bold', color: '#F8FAFC' },
  detailText: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  
  badge: { 
    backgroundColor: '#FDE047', 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 8 
  },
  badgeText: { color: '#0F172A', fontSize: 12, fontWeight: 'bold' }
});